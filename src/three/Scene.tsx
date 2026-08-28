import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
} from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'

import { isDebug, useArt } from '../state/art'
import { useConfig } from '../state/config'
import { viewLayout } from '../ui/layout'
import { ENVIRONMENT_PRESETS, rotationOf } from './environments'
import Underglow from './Underglow'
import { useCarModel } from './useCarModel'

/**
 * The scene shell: canvas, environment, grounding, camera.
 *
 * The lighting rig, floor and fog here are placeholders — day 7 is look-dev day and
 * replaces all of it with dialled values. The material driver has moved out to
 * `useCarModel.ts`, which owns the slug→material map and the config subscription.
 *
 * Two things here are NOT disposable and should survive into day 2:
 *   - `preserveDrawingBuffer` (BRIEF §6 — wire it on day 1, it removes the whole
 *     class of "screenshot captured a blank frame" bugs)
 *   - the camera discipline in §9 of the look-dev spec: fov 30, target at the
 *     beltline, polar angle clamped off the top-down view
 */

/** Measured from the built GLB: sits on y=0, centred in x, 0.238 m forward in z. */
const CAR_CENTRE: [number, number, number] = [0, 0.63, 0.238]

const FOV = 30

/**
 * Fog reference distance. The art store's `fogDensity` is authored as "the density
 * that reads as a light haze with the camera at BASE_DISTANCE"; `fogDensityFor`
 * rescales it to whatever distance the viewport actually needs. This is only the
 * anchor the fog is calibrated against — the camera distance itself comes from
 * `fitDistance`.
 */
const BASE_DISTANCE = 6.2

/**
 * Measured AABB of the built GLB (see `npm run prepare:car`). The car sits on y=0,
 * is centred in x, and is 0.238 m forward in z.
 */
const CAR_MIN = new THREE.Vector3(-1.271, 0, -1.94)
const CAR_MAX = new THREE.Vector3(1.271, 1.149, 2.417)

/** Breathing room around the fitted bounding box. 1.0 would be edge-to-edge. */
const FRAMING_MARGIN = 1.12

/** The hero three-quarter viewing angle, as a unit vector from the orbit target. */
const HERO_DIR = new THREE.Vector3(5.4, 1.9, 6.4).sub(new THREE.Vector3(...CAR_CENTRE)).normalize()

const CAR_CORNERS = [CAR_MIN.x, CAR_MAX.x].flatMap((x) =>
  [CAR_MIN.y, CAR_MAX.y].flatMap((y) =>
    [CAR_MIN.z, CAR_MAX.z].map((z) => new THREE.Vector3(x, y, z)),
  ),
)

/**
 * Smallest camera distance along HERO_DIR that fits the car's bounding box into the
 * part of the canvas the UI is NOT covering.
 *
 * Takes the frustum half-tangents directly rather than an "aspect", because the two are
 * no longer the same thing: `setViewOffset` and the UI margins mean the visible wedge
 * is narrower than the camera's nominal aspect implies, and per-axis at that.
 *
 * Both axes have to be solved. `fov` is the VERTICAL field of view, so a desktop
 * viewport is limited by the vertical axis and a phone by the horizontal; any rule
 * scaled off one axis badly under-scales the other.
 *
 * For a corner P, with the camera at T + dir*d, the offsets perpendicular to the view
 * axis do not depend on d, so it solves in closed form:
 *
 *   a = (P-T)·right, b = (P-T)·up, c = (P-T)·forward
 *   fits when |a| <= (c+d)·tanH and |b| <= (c+d)·tanV
 *   =>  d >= |a|/tanH - c   and   d >= |b|/tanV - c
 */
function fitDistance(tanHalfH: number, tanHalfV: number): number {
  const target = new THREE.Vector3(...CAR_CENTRE)
  const forward = HERO_DIR.clone().negate()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)

  let distance = 0
  for (const corner of CAR_CORNERS) {
    const v = corner.clone().sub(target)
    const a = Math.abs(v.dot(right)) * FRAMING_MARGIN
    const b = Math.abs(v.dot(up)) * FRAMING_MARGIN
    const c = v.dot(forward)
    distance = Math.max(distance, a / tanHalfH - c, b / tanHalfV - c)
  }
  return distance
}

/** Camera position that frames the car into the uncovered canvas. */
function framingPosition(tanHalfH: number, tanHalfV: number): [number, number, number] {
  const p = new THREE.Vector3(...CAR_CENTRE).addScaledVector(
    HERO_DIR,
    fitDistance(tanHalfH, tanHalfV),
  )
  return [p.x, p.y, p.z]
}

function Car() {
  const { scene } = useCarModel()
  return <primitive object={scene} />
}

/**
 * Scene-level environment intensity.
 *
 * three exposes this on the Scene, which is the correct lever: it scales every
 * material's environment contribution at once, so it stays orthogonal to the
 * per-finish `envMapIntensity` values in the LOOKDEV table rather than fighting them.
 */
function EnvironmentIntensity({ value }: { value: number }) {
  const scene = useThree((s) => s.scene)
  const intensity = value
  useEffect(() => {
    // Mutating a three.js object is the intended way to drive the renderer from React;
    // the lint rule is aimed at React state, which this is not.
    // eslint-disable-next-line react/immutability
    scene.environmentIntensity = intensity
  }, [scene, intensity])
  return null
}

/**
 * Requests a frame whenever configuration or art parameters change.
 *
 * Required by `frameloop="demand"`: the renderer is asleep unless something asks it to
 * draw. OrbitControls invalidates itself on every change event (drei does this), so
 * orbiting and damping stay smooth, but a paint colour written straight onto a
 * material bypasses React entirely and would otherwise not show up until the next
 * time the user happened to drag the camera.
 */
function InvalidateOnChange() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const unsubConfig = useConfig.subscribe(() => invalidate())
    const unsubArt = useArt.subscribe(() => invalidate())
    return () => {
      unsubConfig()
      unsubArt()
    }
  }, [invalidate])
  return null
}

/**
 * Under `?debug=1` only: puts the R3F state on `window.r3f` so the camera, scene and
 * renderer can be driven from the console while dialling look-dev on day 7.
 */
function DebugBridge() {
  const state = useThree()
  useEffect(() => {
    ;(globalThis as unknown as { r3f: unknown }).r3f = state
  }, [state])
  return null
}

/**
 * Shifts the rendered image so the car sits centred in the free canvas rather than
 * behind the rail.
 *
 * §12: "Offset the car from centre. Panel on the right → frame the car left-of-centre.
 * Symmetrical framing with asymmetrical UI looks like a bug."
 *
 * `setViewOffset` renders a sub-window of a larger virtual frame, which moves the
 * projection without touching the camera transform — so OrbitControls keeps orbiting
 * about the car rather than about some displaced point.
 *
 * Both axes matter. The rail reduces width on desktop; the bottom sheet reduces height
 * on mobile. Handling only the first hid the whole car behind the sheet on a phone.
 */
function OffsetForUI() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const v = viewLayout(size.width, size.height, FOV)
    if (v.offsetX <= 0 && v.offsetY <= 0) {
      camera.clearViewOffset()
    } else {
      // The aspect must describe the VIRTUAL frame, not the canvas — see ViewLayout.
      // eslint-disable-next-line react/immutability
      camera.aspect = v.aspect
      camera.setViewOffset(
        v.fullWidth,
        v.fullHeight,
        v.offsetX,
        v.offsetY,
        size.width,
        size.height,
      )
    }
    camera.updateProjectionMatrix()
    invalidate()
    return () => {
      camera.clearViewOffset()
      // eslint-disable-next-line react/immutability
      camera.aspect = size.width / size.height
      camera.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height, invalidate])

  return null
}

/** Tone-mapping exposure, live-editable from the debug panel. */
function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl)
  const exposure = value
  useEffect(() => {
    // eslint-disable-next-line react/immutability
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  return null
}

/**
 * Exponential fog is a function of absolute distance, so a density that reads as a
 * light haze with the camera at 6 m swallows the car whole once a portrait viewport
 * pushes it out past 20. Scaling by BASE_DISTANCE/distance holds the amount of fog
 * *at the car* constant, which is what the value was tuned against; the floor still
 * fades out behind it either way.
 *
 * `authored` is the density as dialled at BASE_DISTANCE — the art store's value, so
 * the debug slider stays meaningful at every viewport size.
 */
function fogDensityFor(distance: number, authored: number): number {
  return (authored * BASE_DISTANCE) / distance
}

export default function Scene() {
  // Read once at mount. A placeholder viewer does not need to re-frame on rotate;
  // the camera rig will own that properly later.
  //
  // Framing uses the aspect of the canvas the UI is NOT covering, not the raw viewport.
  // Framing to the full width put roughly half the car underneath the panel — measured
  // at 46.7% covered before this changed.
  const viewport =
    typeof window === 'undefined'
      ? { width: 1600, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight }
  const layout = viewLayout(viewport.width, viewport.height, FOV)
  const distance = fitDistance(layout.tanHalfH, layout.tanHalfV)

  const art = useArt()
  const debug = isDebug()
  const envId = useConfig((s) => s.environment)
  const preset = ENVIRONMENT_PRESETS[envId]
  const drop = useConfig((s) => s.stance.drop)

  /**
   * Quality tier, 0 (weakest) to 2.
   *
   * BRIEF §7 risk 3 is "mid-range mobile perf discovered on day 9". Rather than pick a
   * tier from a device string — which is guesswork and ages badly — PerformanceMonitor
   * watches the actual frame rate and steps down when it cannot hold. Starting at 1
   * means a weak device degrades within a second or two rather than starting bad
   * everywhere.
   *
   * The tier drives what is cheap to change and expensive to render: shadow and
   * environment resolution, and device pixel ratio.
   */
  const [tier, setTier] = useState(1)

  // The preset supplies the baseline; the debug panel multiplies on top of it, so
  // day 7 can dial one scene without silently detuning the other two.
  const scene = {
    background: preset.background,
    fog: preset.fogDensity * (art.fogDensity / 0.055),
    exposure: preset.exposure * (art.exposure / 1.15),
    envIntensity: preset.environmentIntensity * art.environmentIntensity,
    floorColor: preset.floorColor,
    floorRoughness: preset.floorRoughness,
    contactOpacity: preset.contactOpacity * (art.contactOpacity / 0.9),
    contactPoolOpacity: preset.contactPoolOpacity * (art.contactPoolOpacity / 0.4),
  }

  return (
    <Canvas
      dpr={tier >= 2 ? [1, 2] : tier === 1 ? [1, 1.5] : 1}
      // The car is static and the camera only moves when dragged, so drawing at the
      // display refresh rate forever is pure waste — it pins the GPU and heats the
      // machine for frames identical to the last one. On demand, the renderer sleeps
      // until something invalidates. Debug keeps 'always' because the environment
      // re-bakes continuously there and leva sliders need to show live.
      frameloop={debug ? 'always' : 'demand'}
      camera={{
        fov: FOV,
        position: framingPosition(layout.tanHalfH, layout.tanHalfV),
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        // BRIEF §6: from day 1. Costs almost nothing, and without it every
        // screenshot export is a coin flip on an already-cleared buffer.
        preserveDrawingBuffer: true,
        // LOOKDEV §4: Neutral, never ACES. ACES turns a user's #e01010 into brown,
        // which for a paint configurator is a functional bug, not a taste call.
        toneMapping: THREE.NeutralToneMapping,
      }}
    >
      {/* Steps the tier down when frames are being missed and back up when there is
          headroom. `flipflops` stops it oscillating on a borderline device. */}
      <PerformanceMonitor
        bounds={() => [50, 60]}
        flipflops={3}
        onDecline={() => setTier((t) => Math.max(0, t - 1))}
        onIncline={() => setTier((t) => Math.min(2, t + 1))}
      />

      <color attach="background" args={[scene.background]} />
      {/* LOOKDEV §8: light exponential fog, so the floor dissolves into the background
          instead of ending in a hard horizon seam that cuts the frame in half. */}
      <fogExp2 attach="fog" args={[scene.background, fogDensityFor(distance, scene.fog)]} />

      <EnvironmentIntensity value={scene.envIntensity} />
      <Exposure value={scene.exposure} />
      <InvalidateOnChange />
      <OffsetForUI />
      {debug && <DebugBridge />}

      <Suspense fallback={null}>
        <Car />

        {/* A floor, so the contact shadow has something to fall on — on a black void
            a dark shadow is invisible and the car simply floats. Flat and matte for
            now; LOOKDEV §7 wants semi-reflective polished concrete with a roughness
            map, and that is day 7. Base colour is §7's 0.06-0.10 linear grey. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial
            color={scene.floorColor}
            roughness={scene.floorRoughness}
            metalness={0.05}
          />
        </mesh>

        {/* LOOKDEV §6: a real car casts a LAYERED shadow, and shipping one uniformly
            blurred ellipse is named there as the #1 amateur tell — the car reads as a
            sticker on the floor. Two passes:

              tight  almost-black, barely blurred, right at the tyre contact patches.
                     "The darkest pixel in your entire frame should be at the tyre
                     contact patch, and it should be sharp."
              wide   soft car-shaped pool for the underbody cavity, extending past the
                     sills.

            Both bake over a few frames rather than every frame — the car does not move,
            so re-rendering a depth pass continuously is pure waste. Ride height on day 5
            will need this re-triggering. */}
        {/* Keyed on ride height: these bake over a few frames and then stop, so when
            the car moves relative to the floor the pass has to run again. Remounting is
            the cheapest correct trigger drei offers. */}
        <ContactShadows
          key={`tight-${drop}`}
          position={[0, 0.001, CAR_CENTRE[2]]}
          scale={8}
          far={0.5}
          blur={0.6}
          opacity={scene.contactOpacity}
          resolution={tier >= 1 ? 1024 : 512}
          frames={debug ? Infinity : 4}
        />
        <ContactShadows
          key={`pool-${drop}`}
          position={[0, 0.0005, CAR_CENTRE[2]]}
          scale={14}
          far={2}
          blur={art.contactBlur}
          opacity={scene.contactPoolOpacity}
          resolution={tier >= 1 ? 512 : 256}
          frames={debug ? Infinity : 4}
        />

        <Underglow z={CAR_CENTRE[2]} />

        {/* LOOKDEV §3: light with reflected shapes, not lights. Long thin bright
            rectangles against a dark surround — the crisp-edged streak they put down
            the flank is the gloss cue, and a dome or a bare HDRI cannot produce it.

            Built inline rather than with drei's `preset` prop on purpose: the presets
            fetch an HDRI from a third-party CDN at runtime, which is a slow and fragile
            dependency to put in front of a portfolio piece. This is self-contained.

            Keyed on the preset id so switching scenes re-bakes the cube once. */}
        <Environment key={envId} resolution={tier >= 1 ? 512 : 256} frames={debug ? Infinity : 1}>
          {preset.lightformers.map((l, i) => (
            <Lightformer
              key={i}
              form={l.form}
              intensity={l.intensity}
              color={l.color}
              scale={l.scale}
              position={l.position}
              rotation={rotationOf(l)}
            />
          ))}
          {/* NEGATIVE FILL — the dark surround. Not optional: the dark bands between
              the streaks are what make the bright streaks read as bright. */}
          <mesh scale={40}>
            <sphereGeometry />
            <meshBasicMaterial color={preset.surround} side={THREE.BackSide} />
          </mesh>
        </Environment>

      </Suspense>

      <OrbitControls
        target={CAR_CENTRE}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={4}
        maxDistance={40}
        // LOOKDEV §9: never let the camera get above the car or under the floor.
        minPolarAngle={Math.PI * 0.36}
        maxPolarAngle={Math.PI * 0.51}
      />
    </Canvas>
  )
}
