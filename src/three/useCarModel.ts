import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { isDebug, useArt } from '../state/art'
import { effectivePaint, useConfig, type Config } from '../state/config'
import {
  applyCaliperColor,
  applyGlassTint,
  applyLights,
  applyPaintFinish,
  applyRimFinish,
  captureLightBaseline,
  createGlassMaterials,
  type LightBaseline,
} from './finishes'

/**
 * Loads car.glb and hands back a scene whose materials are safe to mutate.
 *
 * The single most load-bearing file in the project (BRIEF §8), for two reasons that
 * are easy to get wrong and painful to debug later.
 *
 * 1. `useGLTF` CACHES the parsed GLTF across the whole app. The materials it hands you
 *    are shared, so mutating them leaks into every other consumer and survives
 *    remounts — you get a car that is still bright red after a "reset", or a second
 *    car that inherits the first one's paint. Everything here is cloned first.
 *
 * 2. Materials are keyed by SLUG, not by mesh. `tools/prepare-car.mjs` normalises all
 *    22 material names to stable slugs (paint1, rim_lip, glass, ...), and three.js
 *    creates a separate material instance per glTF primitive. Cloning per mesh would
 *    give ~107 materials where 22 will do, and then "set the paint red" would mean
 *    finding and updating a dozen of them. One clone per slug means one write.
 *
 * Config is applied imperatively via a store subscription, NOT through React state.
 * Dragging a colour picker fires continuously; re-rendering the tree on every tick
 * would drop frames for no benefit, since nothing about the scene graph changes.
 */

const MODEL_URL = '/models/car.glb'

/** Material slugs produced by the asset pipeline. Asserted there, relied on here. */
export const PAINT_SLUGS = ['paint1', 'paint2'] as const

/**
 * Upgrades a material to MeshPhysicalMaterial without losing anything.
 *
 * Clearcoat, sheen and iridescence — the whole of LOOKDEV §5 — live on
 * MeshPhysicalMaterial. The pipeline leaves the paint materials physical already
 * (they carry KHR_materials_clearcoat), but most of the other 20 are plain Standard.
 *
 * Note the `.copy` call: `MeshPhysicalMaterial.prototype.copy` reads physical-only
 * fields off its source, so copying FROM a Standard material writes `undefined` into
 * clearcoat, sheen and friends. Borrowing Standard's own `copy` instead moves every
 * shared property and map across while leaving the physical defaults intact.
 */
function toPhysical(source: THREE.Material): THREE.MeshPhysicalMaterial {
  if ((source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    return (source as THREE.MeshPhysicalMaterial).clone()
  }
  const physical = new THREE.MeshPhysicalMaterial()
  THREE.MeshStandardMaterial.prototype.copy.call(physical, source as THREE.MeshStandardMaterial)
  physical.name = source.name
  return physical
}

export interface CarModel {
  scene: THREE.Object3D
  /** slug → the one material instance every mesh with that slug shares. */
  materials: Map<string, THREE.MeshPhysicalMaterial>
  /** The asset's own Powdercoat_N flake map (§4.4), shared by every paint finish. */
  flakeMap: THREE.Texture | null
  glass: { tint: THREE.MeshBasicMaterial; reflection: THREE.MeshPhysicalMaterial } | null
  /** Wheel groups plus their as-authored local positions, for the ride-height rig. */
  wheels: { node: THREE.Object3D; origin: THREE.Vector3; localUp: THREE.Vector3 }[]
  /** Emissive values as authored, so "lights off" can restore exactly. */
  lightBaseline: LightBaseline
  /** The Interior* subtree, hidden wholesale once the glass is dark enough. */
  interiorNodes: THREE.Object3D[]
}

/** Threshold past which the cabin is genuinely not visible through the glass. */
const INTERIOR_CULL_TINT = 0.85

/** Wheel groups. Named nodes, guaranteed by the pipeline's assertions. */
const WHEEL_GROUPS = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']

/**
 * Lowers the body while the wheels stay on the ground.
 *
 * The whole car drops by `drop`, then each wheel group is pushed back up by the same
 * amount in its own local space. The compensation cannot assume an axis: this asset is
 * authored Z-up, so a wheel group's local "up" is not necessarily +Y. `localUp` is
 * derived once from the parent's world matrix at build time.
 */
function applyStance(model: CarModel, drop: number) {
  model.scene.position.y = -drop
  for (const wheel of model.wheels) {
    wheel.node.position.copy(wheel.origin).addScaledVector(wheel.localUp, drop)
  }
}

/** Writes the config onto the materials. Pure side effect; no allocation per call. */
function applyConfig(model: CarModel, config: Config) {

  for (const slug of PAINT_SLUGS) {
    const material = model.materials.get(slug)
    if (!material) continue
    const paint = effectivePaint(config, slug)
    applyPaintFinish(material, paint.finish, paint.color, model.flakeMap)
  }

  applyRimFinish(
    model.materials.get('rim_spoke'),
    model.materials.get('rim_lip'),
    config.wheels.finish,
    config.wheels.color,
  )
  applyCaliperColor(model.materials.get('caliper'), config.wheels.caliperColor)

  if (model.glass) {
    applyGlassTint(model.glass.tint, model.glass.reflection, config.glass.tint)
  }

  applyLights(model.materials, model.lightBaseline, config.lights.on, config.lights.headlightColor)
  applyStance(model, config.stance.drop)

  // BRIEF §6's free win: past this tint the cabin is genuinely not visible, so ~30
  // meshes and ~25k triangles can leave the frame entirely. One line, and it is the
  // largest single saving available on mobile.
  const hideInterior = config.glass.tint > INTERIOR_CULL_TINT
  for (const node of model.interiorNodes) node.visible = !hideInterior
}

/**
 * One model per source scene, cached.
 *
 * `useMemo` is NOT a guarantee that a factory runs once — React may discard and
 * recompute it, and StrictMode deliberately double-invokes it in development. Building
 * mutable, effect-observed objects there produced two independent sets of cloned
 * materials: the store subscription closed over one instance while the scene rendered
 * the other, so every colour and tint write landed on an invisible copy. It looked like
 * "the subscription is not firing" and was nothing of the sort.
 *
 * Keying on the source scene fixes it by construction. A WeakMap because `useGLTF`
 * already caches that scene globally, so the derived model should live and die with it
 * rather than being disposed on unmount and left dangling for the next mount.
 */
const MODEL_CACHE = new WeakMap<THREE.Object3D, CarModel>()

function buildCarModel(scene: THREE.Object3D): CarModel {
  const cached = MODEL_CACHE.get(scene)
  if (cached) return cached
  const built = createCarModel(scene)
  MODEL_CACHE.set(scene, built)
  return built
}

function createCarModel(scene: THREE.Object3D): CarModel {
    // Clone the graph so the cached original is never touched. `clone(true)` is
    // enough here: there are no skinned meshes in this asset, so SkeletonUtils and
    // its bone-rebinding are not needed.
    const root = scene.clone(true)
    const materials = new Map<string, THREE.MeshPhysicalMaterial>()

    root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      // A glTF primitive always has exactly one material; the array form only shows
      // up for merged geometry, which the pipeline deliberately never produces.
      const source = mesh.material as THREE.Material
      const slug = source.name

      let material = materials.get(slug)
      if (!material) {
        material = toPhysical(source)
        materials.set(slug, material)
      }
      mesh.material = material
    })

    // Captured before any finish is applied: this is the asset's Powdercoat_N, the
    // metallic-flake normal map that already ships in the GLB (§4.4). Never author one.
    const flakeMap = materials.get('paint1')?.normalMap ?? null
    const lightBaseline = captureLightBaseline(materials)

    // ── Glass: duplicate each pane so two materials share one geometry ────────
    // The clone references the SAME BufferGeometry, so this costs draw calls and
    // nothing else — no extra vertex data reaches the GPU.
    let glass: CarModel['glass'] = null
    const glassSource = materials.get('glass')
    if (glassSource) {
      glass = createGlassMaterials(glassSource)
      const panes: THREE.Mesh[] = []
      root.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh && (mesh.material as THREE.Material)?.name === 'glass') panes.push(mesh)
      })
      for (const pane of panes) {
        pane.material = glass.tint
        pane.renderOrder = 10
        const reflectionPane = pane.clone()
        reflectionPane.material = glass.reflection
        reflectionPane.renderOrder = 11
        reflectionPane.name = `${pane.name}__reflection`
        pane.parent?.add(reflectionPane)
      }
      materials.delete('glass')
    }

    // The Interior* naming is guaranteed by the pipeline, which asserts that no node
    // was renamed or merged — this lookup is only safe because of that.
    const interiorNodes: THREE.Object3D[] = []
    root.traverse((object) => {
      if (object.name.startsWith('Interior')) interiorNodes.push(object)
    })

    // Ride-height rig. Capture each wheel group's authored position and the local
    // direction that corresponds to world +Y, so lowering the body can be compensated
    // without assuming which local axis points up.
    root.updateMatrixWorld(true)
    const wheels: CarModel['wheels'] = []
    for (const name of WHEEL_GROUPS) {
      const node = root.getObjectByName(name)
      if (!node?.parent) continue
      // NOT normalised. This is the local vector whose effect in world space is
      // exactly +1 m of Y, so it carries the parent's scale as well as its rotation.
      // Normalising it made the wheels rise 54 mm for a 45 mm drop, because the parent
      // is scaled and a unit local step is not a unit world step.
      const parentBasis = new THREE.Matrix3().setFromMatrix4(node.parent.matrixWorld).invert()
      const localUp = new THREE.Vector3(0, 1, 0).applyMatrix3(parentBasis)
      wheels.push({ node, origin: node.position.clone(), localUp })
    }

    const model: CarModel = {
      scene: root,
      materials,
      flakeMap,
      glass,
      lightBaseline,
      interiorNodes,
      wheels,
    }
    applyConfig(model, useConfig.getState())
    return model
}

export function useCarModel(): CarModel {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo<CarModel>(() => buildCarModel(scene), [scene])

  useEffect(() => {
    // Under ?debug=1 only: the material map and glass layers on the console, so a
    // finish can be poked at directly while dialling look-dev on day 7.
    if (isDebug()) (globalThis as unknown as { karraj: CarModel }).karraj = model
  }, [model])

  useEffect(() => {
    // Imperative, outside React's render cycle. Fires on every store change and
    // writes straight to the material — no reconciliation, no re-render.
    const unsubscribe = useConfig.subscribe(
      (s) => s as Config,
      (config) => applyConfig(model, config),
      { fireImmediately: true },
    )
    return unsubscribe
  }, [model])

  useEffect(() => {
    // The debug panel edits the finish tables live. Re-applying the current config on
    // every art change is what makes dragging a roughness slider show up immediately.
    return useArt.subscribe(() => applyConfig(model, useConfig.getState()))
  }, [model])


  return model
}

useGLTF.preload(MODEL_URL)
