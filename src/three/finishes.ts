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
