import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { useArt } from '../state/art'
import { effectivePaint, useConfig, type Config } from '../state/config'
import { applyPaintFinish, disposeFlakeVariants } from './finishes'

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
  scene: THREE.Group
  /** slug → the one material instance every mesh with that slug shares. */
  materials: Map<string, THREE.MeshPhysicalMaterial>
  /** The asset's own Powdercoat_N flake map (§4.4), shared by every paint finish. */
  flakeMap: THREE.Texture | null
}

/** Writes the config onto the materials. Pure side effect; no allocation per call. */
function applyConfig(model: CarModel, config: Config) {
  for (const slug of PAINT_SLUGS) {
    const material = model.materials.get(slug)
    if (!material) continue
    const paint = effectivePaint(config, slug)
    applyPaintFinish(material, paint.finish, paint.color, model.flakeMap)
  }
}

export function useCarModel(): CarModel {
  const { scene } = useGLTF(MODEL_URL)

  const model = useMemo<CarModel>(() => {
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

    const model: CarModel = { scene: root, materials, flakeMap }
    applyConfig(model, useConfig.getState())
    return model
  }, [scene])

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


  useEffect(() => {
    // Materials are cloned per mount, so they are this hook's to dispose. Geometry
    // and textures still belong to the useGLTF cache — do NOT dispose those.
    const { materials } = model
    return () => {
      for (const material of materials.values()) material.dispose()
      disposeFlakeVariants()
    }
  }, [model])

  return model
}

useGLTF.preload(MODEL_URL)
