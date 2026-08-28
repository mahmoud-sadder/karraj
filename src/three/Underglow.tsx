import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { useConfig } from '../state/config'

/**
 * Underglow, kept deliberately restrained.
 *
 * KARRAJ-LOOKDEV.md §11 puts this feature "on probation" and is worth quoting, because
 * the obvious implementation is the one it forbids:
 *
 *   "Glowing floor rings or under-car glow — instant peripheral-ad. If you ship it,
 *    keep it as a faint floor bounce, not a visible glowing ring, and default it OFF."
 *
 * So this is a soft radial pool on the floor with no visible edge, additively blended so
 * it can only add light, never darken the contact shadow it sits over. There is no ring,
 * no hue cycling, and it is off unless asked for.
 *
 * The gradient is generated once into a canvas rather than shipped as a texture — it is
 * a few hundred bytes of code against an image request, and it stays resolution
 * independent.
 */

function useGlowTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // Falls off to nothing well before the edge, so there is never a visible boundary.
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.08)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])
}

export default function Underglow({ z }: { z: number }) {
  const on = useConfig((s) => s.underglow.on)
  const color = useConfig((s) => s.underglow.color)
  const intensity = useConfig((s) => s.underglow.intensity)
  const texture = useGlowTexture()

  useEffect(() => () => texture.dispose(), [texture])

  if (!on) return null

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, z]} renderOrder={5}>
      {/* Wider than the car so the falloff finishes off-body — a pool the car sits in,
          not a halo tracing its outline. */}
      <planeGeometry args={[7.5, 7.5]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        opacity={THREE.MathUtils.clamp(intensity, 0, 1) * 0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
