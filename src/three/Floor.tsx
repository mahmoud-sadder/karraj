import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'

import { useArt } from '../state/art'

/**
 * The floor, per KARRAJ-LOOKDEV.md §7.
 *
 * "Semi-reflective sealed/polished concrete with a visible but heavily blurred,
 * short-range reflection. Not a mirror. Not matte. Not black void."
 *
 * The roughness map is the part that matters and the part that is easy to skip:
 *
 *   "Roughness ~0.25-0.35 driven by a grunge/noise map. This matters more than it
 *    sounds: a perfectly uniform floor is a dead giveaway. Non-uniform roughness is
 *    what separates polished concrete from a video-game mirror floor."
 *
 * So the reflection is deliberately broken up rather than even. It is generated into a
 * canvas rather than shipped as an image — a few hundred bytes of code against a
 * texture request, and it stays resolution independent.
 *
 * Calibration from §7, worth repeating because it is the whole test: you should see the
 * car's *colour* smeared beneath it, never the shape of the wheels. **If you can
 * identify wheel spokes in the floor reflection, it is too strong.**
 */

/**
 * Concrete: broad mottling for wear, fine grain on top, faint expansion joints.
 *
 * Built once at module scope rather than in a `useMemo`. The memo would look
 * equivalent and is not: React may discard and recompute it, and because this uses
 * `Math.random` a recompute means different noise — the floor's surface visibly pops.
 * Same trap as the model cache in `useCarModel`.
 */
let concreteRoughness: THREE.CanvasTexture | null = null

function getConcreteRoughness(): THREE.CanvasTexture {
  if (concreteRoughness) return concreteRoughness
  {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)

    // Broad, soft patches — polish wears unevenly, and this is what stops the
    // reflection reading as a single flat sheet.
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 20 + Math.random() * 90
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const shade = Math.random() > 0.5 ? 255 : 0
      g.addColorStop(0, `rgba(${shade},${shade},${shade},${0.05 + Math.random() * 0.09})`)
      g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Fine aggregate grain.
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)

    // Expansion joints. Slightly rougher lines, which read as a real poured floor.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = 2
    for (const p of [0.5]) {
      ctx.beginPath()
      ctx.moveTo(p * size, 0)
      ctx.lineTo(p * size, size)
      ctx.moveTo(0, p * size)
      ctx.lineTo(size, p * size)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    concreteRoughness = texture
  }
  return concreteRoughness
}

export default function Floor({ tier, color }: { tier: number; color: string }) {
  const roughnessMap = getConcreteRoughness()
  const roughness = useArt((s) => s.floorRoughness)
  const mixStrength = useArt((s) => s.floorReflection)

  // The reflection pass costs a full extra render of the scene. On the weakest tier it
  // is the first thing that should go — a matte floor still grounds the car, which is
  // what §6 says actually matters.
  if (tier < 1) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={color} roughness={roughness} roughnessMap={roughnessMap} />
      </mesh>
    )
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        resolution={tier >= 2 ? 512 : 256}
        // Heavy blur and short range: §7 wants the reflection to live for roughly
        // half a car length and then fade, by both distance and blur.
        blur={[400, 100]}
        mixBlur={1}
        mixStrength={mixStrength}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        // Well under 1. A true mirror is the video-game floor §7 warns against.
        mirror={0.35}
        color={color}
        roughness={roughness}
        roughnessMap={roughnessMap}
        metalness={0.05}
      />
    </mesh>
  )
}
