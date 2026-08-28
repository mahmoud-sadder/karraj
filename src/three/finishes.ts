import * as THREE from 'three'

/**
 * The six paint finishes, from KARRAJ-LOOKDEV.md §5.
 *
 * The table is the easy half. The notes under it are where the quality is, and each
 * one is implemented in `applyPaintFinish` below with a comment saying why — they all
 * look like arbitrary fudges until you see what they fix.
 */

export const FINISHES = ['gloss', 'matte', 'satin', 'flake', 'chrome', 'pearl'] as const
export type Finish = (typeof FINISHES)[number]

export interface FinishSpec {
  metalness: number
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  iridescence: number
  iridescenceIOR: number
  sheen: number
  sheenRoughness: number
  envMapIntensity: number
  /** normalScale on the metallic-flake map. 0 means "flat", not "unbound" — see below. */
  normalScale: number
  /** Tiling of the flake map. null when normalScale is 0 and tiling is irrelevant. */
  flakeRepeat: number | null
}

/** LOOKDEV §5, verbatim. Do not tune these here — tune them in the leva panel. */
export const FINISH_SPECS: Record<Finish, FinishSpec> = {
  gloss: {
    metalness: 0.0, roughness: 0.28,
    clearcoat: 1.0, clearcoatRoughness: 0.03,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0.0, sheenRoughness: 0.5,
    envMapIntensity: 1.3, normalScale: 0, flakeRepeat: null,
  },
  matte: {
    metalness: 0.0, roughness: 0.62,
    clearcoat: 0.0, clearcoatRoughness: 0.5,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0.35, sheenRoughness: 0.9,
    envMapIntensity: 0.75, normalScale: 0, flakeRepeat: null,
  },
  satin: {
    metalness: 0.25, roughness: 0.42,
    clearcoat: 0.55, clearcoatRoughness: 0.35,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0.15, sheenRoughness: 0.6,
    envMapIntensity: 1.0, normalScale: 0.06, flakeRepeat: 30,
  },
  flake: {
    // 0.9 and not 1.0 — see the note in applyPaintFinish.
    metalness: 0.9, roughness: 0.22,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0.0, sheenRoughness: 0.5,
    envMapIntensity: 1.6, normalScale: 0.35, flakeRepeat: 40,
  },
  chrome: {
    metalness: 1.0, roughness: 0.04,
    clearcoat: 0.0, clearcoatRoughness: 0.5,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0.0, sheenRoughness: 0.5,
    envMapIntensity: 1.9, normalScale: 0, flakeRepeat: null,
  },
  pearl: {
    metalness: 0.0, roughness: 0.3,
    clearcoat: 1.0, clearcoatRoughness: 0.03,
    // The asset's own Pearl variant ships [820, 920] at IOR 1.2, which is very nearly
    // invisible. §5 widens the range and lifts the IOR into the range where the
    // interference actually reads without going soap-bubble.
    iridescence: 0.75, iridescenceIOR: 1.32,
    sheen: 0.2, sheenRoughness: 0.4,
    envMapIntensity: 1.4, normalScale: 0.12, flakeRepeat: 60,
  },
}

export const PEARL_THICKNESS_RANGE: [number, number] = [420, 1000]

/**
 * Flake-map clones, keyed by tiling.
 *
 * §5 gets "two flake grades for free" by reusing the one 128px nearest-filtered map
 * at different `repeat` — 30 reads as coarse show-flake, 60+ as fine metallic. Clones
 * share `.source`, so the image is uploaded to the GPU exactly once no matter how
 * many tilings are live.
 */
const flakeVariants = new Map<number, THREE.Texture>()

function flakeMapAt(source: THREE.Texture, repeat: number): THREE.Texture {
  const existing = flakeVariants.get(repeat)
  if (existing) return existing
  const clone = source.clone()
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping
  clone.repeat.set(repeat, repeat)
  // NEAREST filtering is deliberate and comes from the asset: the flake is meant to
  // read as discrete glinting particles, and bilinear smearing averages them away.
  clone.magFilter = THREE.NearestFilter
  clone.needsUpdate = true
  flakeVariants.set(repeat, clone)
  return clone
}

export function disposeFlakeVariants() {
  for (const texture of flakeVariants.values()) texture.dispose()
  flakeVariants.clear()
}

const scratch = new THREE.Color()
const WHITE = new THREE.Color(0xffffff)

/**
 * Writes a finish onto a paint material.
 *
 * `flakeSource` is the asset's own Powdercoat_N (§4.4) — a 128px nearest-filtered
 * normal map that already ships in the GLB. Never author one.
 */
export function applyPaintFinish(
  material: THREE.MeshPhysicalMaterial,
  finish: Finish,
  colorHex: string,
  flakeSource: THREE.Texture | null,
) {
  const spec = FINISH_SPECS[finish]

  material.metalness = spec.metalness
  material.roughness = spec.roughness
  material.clearcoat = spec.clearcoat
  material.clearcoatRoughness = spec.clearcoatRoughness
  material.envMapIntensity = spec.envMapIntensity

  // ── Base colour, adjusted per finish ─────────────────────────────────────
  scratch.setStyle(colorHex, THREE.SRGBColorSpace)

  if (finish === 'chrome') {
    // A "tinted mirror" reads as a rendering bug, not as chrome. Lerping 85% toward
    // white makes the user's pick show up as a subtle cast — gold chrome, black
    // chrome — which is how tinted chrome actually behaves.
    scratch.lerp(WHITE, 0.85)
  } else if (finish === 'flake') {
    // The metallic BRDF has no diffuse term, so it loses luminance. Lifting the base
    // ~12% keeps a flake red looking like the swatch the user clicked.
    scratch.lerp(WHITE, 0.12)
  }
  material.color.copy(scratch)

  // ── Sheen: the single highest-value trick in the table ───────────────────
  // Roughness alone gives "dirty gloss". Sheen adds the retroreflective velvet edge
  // that real matte vinyl has, and lerping the sheen colour toward white is what
  // makes that edge read as light catching the surface rather than as a lighter paint.
  material.sheen = spec.sheen
  material.sheenRoughness = spec.sheenRoughness
  material.sheenColor.copy(scratch).lerp(WHITE, 0.25)

  // ── Iridescence: pearl only ──────────────────────────────────────────────
  material.iridescence = spec.iridescence
  material.iridescenceIOR = spec.iridescenceIOR
  material.iridescenceThicknessRange = [...PEARL_THICKNESS_RANGE]

  // ── Flake normal ─────────────────────────────────────────────────────────
  // On normalMap, NEVER clearcoatNormalMap: noise on the coat reads as frosted glass
  // rather than as metallic particles suspended under it.
  //
  // The map stays bound even at scale 0. Swapping normalMap to null and back would
  // change the shader's defines and force a program recompile on every finish switch,
  // which is a visible hitch in a configurator people flip through quickly.
  if (flakeSource) {
    material.normalMap = spec.flakeRepeat
      ? flakeMapAt(flakeSource, spec.flakeRepeat)
      : flakeSource
    material.normalScale.set(spec.normalScale, spec.normalScale)
  }

  material.needsUpdate = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheels
// ─────────────────────────────────────────────────────────────────────────────

export const RIM_FINISHES = [
  'silver', 'gloss_black', 'matte_black', 'gunmetal', 'chrome', 'bronze',
] as const
export type RimFinish = (typeof RIM_FINISHES)[number]

interface RimSpec {
  metalness: number
  roughness: number
  clearcoat: number
  /** How far the finish drags the user's colour toward its own base. */
  tintToward: string
  tintAmount: number
  envMapIntensity: number
}

/**
 * Rim finishes are their own table rather than reusing the paint one.
 *
 * Wheels sit in a wheel arch — mostly in shadow, seen at a glancing angle, and always
 * against tyre rubber. A paint finish calibrated for a large convex bonnet reads far
 * too bright there. These are darker and rougher across the board for that reason.
 */
const RIM_SPECS: Record<RimFinish, RimSpec> = {
  silver:      { metalness: 1.0, roughness: 0.28, clearcoat: 0.0, tintToward: '#d9dde2', tintAmount: 0.75, envMapIntensity: 1.2 },
  gloss_black: { metalness: 0.0, roughness: 0.14, clearcoat: 1.0, tintToward: '#0b0c0e', tintAmount: 0.80, envMapIntensity: 1.1 },
  matte_black: { metalness: 0.0, roughness: 0.68, clearcoat: 0.0, tintToward: '#131518', tintAmount: 0.80, envMapIntensity: 0.7 },
  gunmetal:    { metalness: 1.0, roughness: 0.42, clearcoat: 0.0, tintToward: '#3c4046', tintAmount: 0.60, envMapIntensity: 1.0 },
  chrome:      { metalness: 1.0, roughness: 0.04, clearcoat: 0.0, tintToward: '#ffffff', tintAmount: 0.85, envMapIntensity: 1.6 },
  bronze:      { metalness: 1.0, roughness: 0.30, clearcoat: 0.0, tintToward: '#8a6a3a', tintAmount: 0.65, envMapIntensity: 1.2 },
}

export function applyRimFinish(
  spoke: THREE.MeshPhysicalMaterial | undefined,
  lip: THREE.MeshPhysicalMaterial | undefined,
  finish: RimFinish,
  colorHex: string,
) {
  const spec = RIM_SPECS[finish]
  scratch.setStyle(colorHex, THREE.SRGBColorSpace).lerp(
    new THREE.Color().setStyle(spec.tintToward, THREE.SRGBColorSpace),
    spec.tintAmount,
  )

  for (const material of [spoke, lip]) {
    if (!material) continue
    material.color.copy(scratch)
    material.metalness = spec.metalness
    material.roughness = spec.roughness
    material.clearcoat = spec.clearcoat
    material.envMapIntensity = spec.envMapIntensity
    material.needsUpdate = true
  }

  // The lip is the polished outer edge and stays brighter than the spokes whatever
  // finish is chosen — that contrast is what stops a wheel reading as one flat disc.
  if (lip) {
    lip.roughness = Math.max(0.03, spec.roughness * 0.45)
    lip.metalness = Math.max(spec.metalness, 0.85)
  }
}

export function applyCaliperColor(
  caliper: THREE.MeshPhysicalMaterial | undefined,
  colorHex: string,
) {
  if (!caliper) return
  caliper.color.setStyle(colorHex, THREE.SRGBColorSpace)
  caliper.metalness = 0.1
  caliper.roughness = 0.45
  caliper.needsUpdate = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass — the two-layer treatment from BRIEF §6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why glass is two materials and not one.
 *
 * `KHR_materials_transmission` is the physically correct answer and it is already
 * stripped in the pipeline: it forces an extra render-target pass every frame, 8-15ms
 * on a mid-range Android, for one feature.
 *
 * The obvious replacement — a single alpha-blended material — fails for a subtler
 * reason. three multiplies the *entire* outgoing radiance by `opacity`, specular
 * included. So as tint rises the reflections fade out along with the transparency, and
 * at 80% you get a dark hole in the bodywork with no highlight at all. It reads as
 * painted cardboard, not as a tinted window. Real tint film darkens what you see
 * through the glass; it does not stop the glass reflecting the sky.
 *
 * Two layers over the same geometry decouple those:
 *
 *   tint       alpha-blended, dark, envMapIntensity 0, depthWrite false, renderOrder 10
 *   reflection black base, metalness 1, ADDITIVE blending, depthWrite false, order 11
 *
 * Additive blending is the key: the reflection layer only ever *adds* light, so it is
 * unaffected by how opaque the tint layer underneath is. Cost is one extra draw call
 * per glass mesh, no additional geometry upload and no render targets.
 */
export function createGlassMaterials(source: THREE.MeshPhysicalMaterial): {
  tint: THREE.MeshBasicMaterial
  reflection: THREE.MeshPhysicalMaterial
} {
  // MeshBasicMaterial, not Physical. The tint layer's whole job is to block light, and
  // an unlit material does exactly (1 - opacity) with nothing else in the way — no IBL,
  // no dielectric specular, no tone-mapped surprises. Cloning the physical glass here
  // and zeroing envMapIntensity looked equivalent and was not: it still rendered a
  // shaded surface that got *brighter* as opacity rose, which is the opposite of a
  // tint film. It is also cheaper, which matters for a layer drawn twice per pane.
  const tint = new THREE.MeshBasicMaterial()
  tint.name = 'glass_tint'
  tint.transparent = true
  tint.depthWrite = false
  tint.color.setRGB(0.015, 0.017, 0.02)
  tint.side = THREE.DoubleSide

  const reflection = source.clone()
  reflection.name = 'glass_reflection'
  reflection.transparent = true
  reflection.depthWrite = false
  reflection.blending = THREE.AdditiveBlending
  reflection.color.setRGB(0, 0, 0) // additive: base colour contributes nothing
  reflection.metalness = 1
  reflection.roughness = 0.03
  reflection.clearcoat = 0
  reflection.opacity = 1
  reflection.side = THREE.FrontSide

  return { tint, reflection }
}

export function applyGlassTint(
  tint: THREE.MeshBasicMaterial,
  reflection: THREE.MeshPhysicalMaterial,
  amount: number,
) {
  const t = THREE.MathUtils.clamp(amount, 0, 1)
  // Never fully clear: even untinted automotive glass is slightly green and never
  // invisible, and 0 opacity would make the layer pointless.
  tint.opacity = THREE.MathUtils.lerp(0.18, 0.94, t)

  // Deliberately NOT a function of `t`. Reflection strength is independent of how dark
  // the film is — that independence is the entire reason for the second layer.
  reflection.envMapIntensity = 1.35
}

// ─────────────────────────────────────────────────────────────────────────────
// Lights
// ─────────────────────────────────────────────────────────────────────────────

export const LIGHT_SLUGS = ['headlight', 'taillight', 'signal', 'dash'] as const
export type LightSlug = (typeof LIGHT_SLUGS)[number]

/**
 * Emissive strengths as authored in the asset, captured before anything is changed so
 * "off" can restore exactly. LOOKDEV §10 sets the bloom threshold at 1.0 in a linear
 * workspace precisely so that only these blow out and paint highlights do not.
 */
export type LightBaseline = Map<LightSlug, { intensity: number; color: THREE.Color }>

export function captureLightBaseline(
  materials: Map<string, THREE.MeshPhysicalMaterial>,
): LightBaseline {
  const baseline: LightBaseline = new Map()
  for (const slug of LIGHT_SLUGS) {
    const material = materials.get(slug)
    if (!material) continue
    baseline.set(slug, {
      intensity: material.emissiveIntensity,
      color: material.emissive.clone(),
    })
  }
  return baseline
}

export function applyLights(
  materials: Map<string, THREE.MeshPhysicalMaterial>,
  baseline: LightBaseline,
  on: boolean,
  headlightColor: string,
) {
  for (const slug of LIGHT_SLUGS) {
    const material = materials.get(slug)
    const base = baseline.get(slug)
    if (!material || !base) continue

    if (slug === 'headlight') {
      material.emissive.setStyle(headlightColor, THREE.SRGBColorSpace)
    } else {
      material.emissive.copy(base.color)
    }

    // The dash stays lit with the lights off — it is an interior readout, and killing
    // it makes the cabin look broken rather than switched off.
    material.emissiveIntensity = on || slug === 'dash' ? base.intensity : 0
    material.needsUpdate = true
  }
}
