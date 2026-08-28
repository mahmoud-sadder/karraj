import * as THREE from 'three'

/**
 * The garage set, per KARRAJ-LOOKDEV.md §8.
 *
 * §8's argument for building this at all, and for building it badly on purpose:
 *
 *   "Three to six low-poly props at mid-distance: tyre stack, tool chest, floor jack,
 *    cone. They exist primarily to appear in reflections. Even ugly ones work —
 *    they'll be a blurry 15-pixel smear on the flank. This is the cheapest
 *    storytelling in the project."
 *
 * And the reason it reads as a garage rather than a showroom is clutter at mid-distance:
 * a showroom reflects clean rectangles, a garage reflects junk. So these are primitives
 * — boxes and cylinders — placed where they will catch in the paint, not modelled.
 *
 * Everything is kept outside the car's framing and behind it, so nothing competes for
 * attention. §8's exposure rule: the environment sits at 15-25% of the visual weight,
 * walls at 5-15% luminance, and the viewer's eye never leaves the car.
 */

// §8: walls sit at 5-15% luminance. Any brighter and the room competes with the car.
const WALL = '#0e1013'
const PROP = '#1b1e23'
const PROP_DARK = '#101216'

/**
 * Kept deliberately low. A four-high stack stands 0.88 m and, from the default camera,
 * projected clean over the car's roofline as two dark blades that read as fins growing
 * out of the roof. §8 wants props at mid-distance appearing as a blurry smear in the
 * paint, not as silhouettes competing with the car's outline.
 */
function TyreStack({ position, count = 2 }: { position: [number, number, number]; count?: number }) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => i).map((i) => (
        <mesh key={i} position={[0, 0.11 + i * 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.2, 16]} />
          <meshStandardMaterial color={PROP_DARK} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function ToolChest({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.55]} />
        <meshStandardMaterial color={PROP} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Drawer lines catch a highlight and read as a tool chest rather than a box. */}
      {[0.25, 0.5, 0.75].map((y) => (
        <mesh key={y} position={[0, y, 0.29]}>
          <boxGeometry args={[1.0, 0.02, 0.02]} />
          <meshStandardMaterial color="#3a4048" roughness={0.35} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Cone({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]}>
        <coneGeometry args={[0.16, 0.48, 12]} />
        <meshStandardMaterial color="#8a3a12" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.32]} />
        <meshStandardMaterial color={PROP_DARK} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Jack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.0, 0.16, 0.34]} />
        <meshStandardMaterial color={PROP} roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh position={[0.35, 0.26, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.7, 0.06, 0.06]} />
        <meshStandardMaterial color="#40464e" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

export default function GarageSet() {
  return (
    <group>
      {/* A simple box room. §8: ~13 x 10 x 5 m, six planes, costs nothing. The room's
          closeness is why it reads as a garage — the car's reflections are full of
          nearby, dim, cluttered surfaces rather than a distant void. */}
      <mesh position={[0, 2.5, -6.5]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color={WALL} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-7, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[13, 5]} />
        <meshStandardMaterial color={WALL} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[7, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[13, 5]} />
        <meshStandardMaterial color={WALL} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 13]} />
        <meshStandardMaterial color="#0e1013" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Clutter, at mid-distance and behind the car so it appears in the paint
          without competing for attention. */}
      <TyreStack position={[-5.9, 0, -3.4]} count={3} />
      <TyreStack position={[-5.2, 0, -4.2]} count={2} />
      <ToolChest position={[5.2, 0, -4.8]} rotation={-0.35} />
      <Jack position={[-5.3, 0, -1.2]} />
      <Cone position={[5.4, 0, -2.4]} />
      <Cone position={[-6.0, 0, 1.4]} />

      {/* Visible fixtures, deliberately dim.
          These are set dressing, NOT light sources — a Lightformer only contributes to
          the environment map when it is a child of <Environment>, and these are in the
          main scene. Rendered at full intensity they were simply floating white
          rectangles that pulled the eye straight off the car, which is the opposite of
          §8's exposure rule: the environment carries 15-25% of the visual weight and
          the viewer's eye never leaves the car. The lighting itself comes from the
          preset's rig. */}
      <mesh position={[-6.85, 3.1, -2.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.16]} />
        <meshBasicMaterial color="#4a2f16" toneMapped={false} />
      </mesh>
      {/* A thin strip under the roller shutter — a depth cue at the back of the room
          that mostly shows up as a smear in the floor. */}
      <mesh position={[0, 0.07, -6.42]}>
        <planeGeometry args={[3.2, 0.05]} />
        <meshBasicMaterial color="#2b3440" toneMapped={false} />
      </mesh>
    </group>
  )
}
