import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * The configuration store.
 *
 * This is the source of truth for everything the user can change, and it will end up
 * being the de-facto schema for the URL codec (BRIEF §8, day 8). Keep it flat, keep it
 * serialisable, and keep three.js types out of it — nothing here should import `three`.
 *
 * Deliberately NOT the render path. Material changes are applied imperatively by
 * `useCarModel`, which subscribes to this store and mutates the materials directly.
 * Re-rendering React on every tick of a colour picker would drop frames for no reason.
 */

export interface PaintConfig {
  /** Hex string, e.g. `#b3122a`. Stored as authored (sRGB), converted at apply time. */
  color: string
}

export interface Config {
  paint1: PaintConfig
  paint2: PaintConfig
}

export interface ConfigStore extends Config {
  setPaintColor: (slot: 'paint1' | 'paint2', color: string) => void
  reset: () => void
}

export const DEFAULT_CONFIG: Config = {
  // The asset's own "Carmine" — a reasonable place to start, and it makes an
  // accidental no-op change obvious during development.
  paint1: { color: '#b3122a' },
  paint2: { color: '#1a1c20' },
}

export const useConfig = create<ConfigStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_CONFIG,
    setPaintColor: (slot, color) => set((s) => ({ [slot]: { ...s[slot], color } }) as Partial<ConfigStore>),
    reset: () => set(DEFAULT_CONFIG),
  })),
)
