import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import type { Finish } from '../three/finishes'

/**
 * The configuration store — everything the user can change.
 *
 * This will become the de-facto schema for the URL codec (BRIEF §8, day 8), so keep it
 * flat, serialisable, and free of three.js types.
 *
 * Deliberately NOT the render path. `useCarModel` subscribes and mutates materials
 * directly; re-rendering React on every tick of a colour picker would drop frames for
 * nothing, since the scene graph never changes.
 */

export interface PaintConfig {
  /** Hex string as authored (sRGB). Converted to linear at apply time. */
  color: string
  finish: Finish
}

export interface Config {
  paint1: PaintConfig
  paint2: PaintConfig
  /**
   * When false, paint2 mirrors paint1 so the car reads as a single colour. The asset
   * already separates the two across its panels, so this is a display choice rather
   * than a material change.
   */
  twoTone: boolean
}

export type PaintSlot = 'paint1' | 'paint2'

export interface ConfigStore extends Config {
  setPaintColor: (slot: PaintSlot, color: string) => void
  setPaintFinish: (slot: PaintSlot, finish: Finish) => void
  setTwoTone: (twoTone: boolean) => void
  reset: () => void
}

export const DEFAULT_CONFIG: Config = {
  paint1: { color: '#b3122a', finish: 'gloss' },
  paint2: { color: '#1a1c20', finish: 'gloss' },
  twoTone: false,
}

export const useConfig = create<ConfigStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_CONFIG,
    setPaintColor: (slot, color) =>
      set((s) => ({ [slot]: { ...s[slot], color } }) as Partial<ConfigStore>),
    setPaintFinish: (slot, finish) =>
      set((s) => ({ [slot]: { ...s[slot], finish } }) as Partial<ConfigStore>),
    setTwoTone: (twoTone) => set({ twoTone }),
    reset: () => set(DEFAULT_CONFIG),
  })),
)

/** What paint2 should actually render as, given the two-tone toggle. */
export function effectivePaint(config: Config, slot: PaintSlot): PaintConfig {
  if (slot === 'paint2' && !config.twoTone) return config.paint1
  return config[slot]
}
