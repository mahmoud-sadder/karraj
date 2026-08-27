import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'

/**
 * PLACEHOLDER VIEWER — day 2 replaces all of this.
 *
 * Just enough to get car.glb on screen and orbitable. There is deliberately no
 * config store, no slug→material map, no `toPhysical` upgrade and no UI; those are
 * `useCarModel.ts` and they are the actual day-2 milestone. Treat this file as
 * disposable.
 *
 * Two things here are NOT disposable and should survive into day 2:
 *   - `preserveDrawingBuffer` (BRIEF §6 — wire it on day 1, it removes the whole
 *     class of "screenshot captured a blank frame" bugs)
 *   - the camera discipline in §9 of the look-dev spec: fov 30, target at the
 *     beltline, polar angle clamped off the top-down view
 */

const MODEL_URL = '/models/car.glb'

/** Measured from the built GLB: sits on y=0, centred in x, 0.238 m forward in z. */
const CAR_CENTRE: [number, number, number] = [0, 0.63, 0.238]

const FOV = 30

/**
 * Fog reference point. BASE_FOG_DENSITY is the density that reads as a light haze
 * with the camera at BASE_DISTANCE; `fogDensityFor` scales it to the real framing
 * distance. Framing itself is solved in `fitDistance` — these two are only the anchor
 * the fog is calibrated against, not the camera distance.
 */
const BASE_DISTANCE = 6.2
const BASE_FOG_DENSITY = 0.055

/** Fallback aspect when there is no window to measure (never hit in the browser). */
const BASE_ASPECT = 16 / 9

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
 * Smallest camera distance along HERO_DIR that fits the car's bounding box in BOTH
 * axes of the frustum.
 *
 * `fov` is the VERTICAL field of view, so a portrait phone has a far narrower
 * horizontal one — 14 degrees at 375x812 against 51 at 16:9. Framing has to be solved
 * per-axis, not scaled off one of them: a desktop viewport is limited by the vertical
 * axis and a phone by the horizontal, so any single-axis rule badly under-scales one
 * of the two. That was the bug this replaced, and it cropped the car on every phone.
 *
 * For a corner P, with camera at T + dir*d, the offsets perpendicular to the view axis
 * are independent of d, so the constraint solves in closed form:
 *
 *   a = (P-T)·right, b = (P-T)·up, c = (P-T)·forward
 *   fits when |a| <= (c+d)·tan(hHalf) and |b| <= (c+d)·tan(vHalf)
 *   =>  d >= |a|/tan(hHalf) - c   and   d >= |b|/tan(vHalf) - c
 *
 * Sanity check: at 16:9 this yields 6.09 m, which is within a few centimetres of the
 * distance that was tuned by eye before the maths existed.
 */
function fitDistance(aspect: number): number {
  const vHalf = THREE.MathUtils.degToRad(FOV) / 2
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  const tanV = Math.tan(vHalf)
  const tanH = Math.tan(hHalf)

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
    distance = Math.max(distance, a / tanH - c, b / tanV - c)
  }
  return distance
}

/**
 * Camera position for a given viewport aspect.
 *
 * Computed BEFORE the Canvas mounts, deliberately. Setting `camera.position` from an
 * effect afterwards does not stick: OrbitControls has already taken ownership of the
 * camera and recomputes it from its own state every frame. Handing the right position
 * to the `camera` prop lets OrbitControls initialise from it instead of fighting it.
 */
function framingPosition(aspect: number): [number, number, number] {
  const p = new THREE.Vector3(...CAR_CENTRE).addScaledVector(HERO_DIR, fitDistance(aspect))
  return [p.x, p.y, p.z]
}

function Car() {
  const { scene } = useGLTF(MODEL_URL)
  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)

/**
 * Exponential fog is a function of absolute distance, so a density that reads as a
 * light haze with the camera at 6 m swallows the car whole once a portrait viewport
 * pushes it out past 20. Scaling by BASE_DISTANCE/distance holds the amount of fog
 * *at the car* constant, which is what the value was tuned against; the floor still
 * fades out behind it either way.
 */
function fogDensityFor(aspect: number): number {
  return (BASE_FOG_DENSITY * BASE_DISTANCE) / fitDistance(aspect)
}

export default function Scene() {
  // Read once at mount. A placeholder viewer does not need to re-frame on rotate;
  // day 2's camera rig will own that properly.
  const aspect =
    typeof window === 'undefined' ? BASE_ASPECT : window.innerWidth / window.innerHeight

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, position: framingPosition(aspect), near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        // BRIEF §6: from day 1. Costs almost nothing, and without it every
        // screenshot export is a coin flip on an already-cleared buffer.
        preserveDrawingBuffer: true,
        // LOOKDEV §4: Neutral, never ACES. ACES turns a user's #e01010 into brown,
        // which for a paint configurator is a functional bug, not a taste call.
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 1.15,
      }}
    >
      <color attach="background" args={['#0a0b0d']} />
      {/* LOOKDEV §8: light exponential fog, so the floor dissolves into the background
          instead of ending in a hard horizon seam that cuts the frame in half. */}
      <fogExp2 attach="fog" args={['#0a0b0d', fogDensityFor(aspect)]} />

      <Suspense fallback={null}>
        <Car />

        {/* A floor, so the contact shadow has something to fall on — on a black void
            a dark shadow is invisible and the car simply floats. Flat and matte for
            now; LOOKDEV §7 wants semi-reflective polished concrete with a roughness
            map, and that is day 7. Base colour is §7's 0.06-0.10 linear grey. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#31353b" roughness={0.45} metalness={0.05} />
        </mesh>

        {/* LOOKDEV §6: a car with no contact shadow reads as a sticker on the floor.
            One pass here; day 7 splits it into the tight contact patch + wide
            underbody pool. */}
        <ContactShadows
          position={[0, 0.001, CAR_CENTRE[2]]}
          scale={11}
          far={1.6}
          blur={2.2}
          opacity={0.72}
          resolution={1024}
        />

        {/* LOOKDEV §3: light with reflected shapes, not lights. Long thin bright
            rectangles against a dark surround — the crisp-edged streak they put down
            the flank is the gloss cue.

            Built inline rather than with drei's `preset` prop on purpose: the presets
            fetch an HDRI from a third-party CDN at runtime, which is a slow, fragile
            dependency to put in front of a portfolio piece. This is self-contained. */}
        <Environment resolution={512} frames={1}>
          {/* KEY — nose-to-tail strip, high above. Does the work on the paint. */}
          <Lightformer
            form="rect"
            intensity={6}
            color="#f2f6ff"
            scale={[10, 1.1]}
            position={[0, 6, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          {/* FLANK STRIPS — make the side streaks. */}
          <Lightformer
            form="rect"
            intensity={3}
            color="#e8f0ff"
            scale={[9, 0.8]}
            position={[-5, 3, 0]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#e8f0ff"
            scale={[9, 0.8]}
            position={[5, 3, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          />
          {/* REAR 3/4 KICKER — rims the shoulder line, separates car from background. */}
          <Lightformer form="rect" intensity={8} scale={[2, 2]} position={[3.5, 2.2, -5]} />
          {/* WARM FILL — the cinematography move. Warm shadows against a cool key. */}
          <Lightformer
            form="rect"
            intensity={1}
            color="#ffd9b0"
            scale={[7, 2.6]}
            position={[-4.5, 0.6, 3]}
          />
          {/* NEGATIVE FILL — the dark surround is what makes the streaks read as bright. */}
          <mesh scale={40}>
            <sphereGeometry />
            <meshBasicMaterial color="#0a0b0d" side={THREE.BackSide} />
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
