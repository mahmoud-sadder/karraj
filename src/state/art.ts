import { create } from 'zustand'

import { FINISH_SPECS, type Finish, type FinishSpec } from '../three/finishes'

/**
 * Art-direction parameters, separated from user configuration on purpose.
 *
 * BRIEF §7 names look-dev as risk #1 and prescribes the mitigation: wire every art
 * parameter into a leva panel on day 3, so day 7 is dialling knobs rather than writing
 * code under deadline. This store is that surface.
 *
 * Nothing here is user-facing and none of it belongs in the URL codec. The defaults
 * are the values from KARRAJ-LOOKDEV.md; leva overwrites them in place when the debug
 * panel is open, and day 7 ends by hard-coding whatever won and deleting the panel.
 */

export interface ArtParams {
  exposure: number
  environmentIntensity: number
  fogDensity: number

  floorColor: string
  floorRoughness: number
  /** MeshReflectorMaterial mixStrength. §7 wants 0.4-0.6 — never a mirror. */
  floorReflection: number

  keyIntensity: number
  flankLeftIntensity: number
  flankRightIntensity: number
  kickerIntensity: number
  fillIntensity: number

  /** Tight pass — the contact patches. Near-black and barely blurred (§6). */
  bloomIntensity: number
  bloomThreshold: number
  vignetteOffset: number
  vignetteDarkness: number

  /** Tight pass — the contact patches. Near-black and barely blurred (§6). */
  contactOpacity: number
  /** Wide pass — the underbody cavity pool. Soft and much weaker (§6). */
  contactPoolOpacity: number
  contactBlur: number

  /** Live-editable copies of the six finish tables. */
  finishes: Record<Finish, FinishSpec>
}

export interface ArtStore extends ArtParams {
  set: (patch: Partial<ArtParams>) => void
  setFinishParam: <K extends keyof FinishSpec>(
    finish: Finish,
    key: K,
    value: FinishSpec[K],
  ) => void
  reset: () => void
}

export const DEFAULT_ART: ArtParams = {
  // LOOKDEV §4: NeutralToneMapping at 1.0–1.3.
  exposure: 1.15,
  environmentIntensity: 1.0,
  fogDensity: 0.055,

  // LOOKDEV §7: 0.06–0.10 linear grey. Dark, but never pure black — a black floor
  // loses all contact reading.
  floorColor: '#31353b',
  floorRoughness: 0.32,
  floorReflection: 0.5,

  // LOOKDEV §3 intensity ratios: key 1.0 → flanks 0.6–0.8 → kicker 1.2–2.0 → fill 0.1–0.2.
  keyIntensity: 6,
  flankLeftIntensity: 3,
  flankRightIntensity: 2,
  kickerIntensity: 8,
  fillIntensity: 1,

  // §10: threshold 1.0 in a linear workspace means only the emissive lights bloom.
  bloomIntensity: 0.55,
  bloomThreshold: 1.0,
  vignetteOffset: 0.28,
  vignetteDarkness: 0.55,

  contactOpacity: 0.9,
  contactPoolOpacity: 0.4,
  contactBlur: 3,

  finishes: structuredClone(FINISH_SPECS),
}

export const useArt = create<ArtStore>()((set) => ({
  ...DEFAULT_ART,
  set: (patch) => set(patch),
  setFinishParam: (finish, key, value) =>
    set((s) => ({
      finishes: { ...s.finishes, [finish]: { ...s.finishes[finish], [key]: value } },
    })),
  reset: () => set(structuredClone(DEFAULT_ART)),
}))

/** `?debug=1` gates the leva panel and the live environment re-bake. */
export const isDebug = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
