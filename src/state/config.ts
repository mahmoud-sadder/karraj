import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import type { EnvironmentId } from '../three/environments'
import type { Finish, RimFinish } from '../three/finishes'

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

export interface WheelConfig {
  finish: RimFinish
  /** Tints the rim. Ignored by finishes that lerp hard toward their own base. */
  color: string
  caliperColor: string
}

export interface GlassConfig {
  /**
   * 0 = clear, 1 = limousine black. Jordan's DVLD caps this at 50% (day 9), which is
   * why it is stored as a continuous value rather than a set of presets.
   */
  tint: number
}

export interface LightsConfig {
  on: boolean
  headlightColor: string
}

export interface StanceConfig {
  /**
   * Metres the body drops relative to the wheels. Positive lowers.
   * Jordan's DVLD treats suspension changes as a registrable modification (day 9).
   */
  drop: number
}

export interface UnderglowConfig {
  /**
   * OFF by default, deliberately. LOOKDEV §11 puts underglow "on probation": a visible
   * glowing ring is the single most common gaming-peripheral signifier and fights the
   * light-band language the rest of the scene is built on. Shipped as a faint floor
   * bounce, never a ring.
   */
  on: boolean
  color: string
  intensity: number
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
  wheels: WheelConfig
  glass: GlassConfig
  lights: LightsConfig
  stance: StanceConfig
  underglow: UnderglowConfig
  environment: EnvironmentId
}

export type PaintSlot = 'paint1' | 'paint2'

/**
 * Every addressable setting, as a dotted path.
 *
 * A union rather than `string` on purpose: the UI schema references these by path, so a
 * typo becomes a compile error instead of a control that silently does nothing. It also
 * becomes the field list for the day-8 URL codec — one place that enumerates the config
 * surface, rather than three that drift apart.
 */
export type ConfigPath =
  | 'paint1.color'
  | 'paint1.finish'
  | 'paint2.color'
  | 'paint2.finish'
  | 'twoTone'
  | 'wheels.finish'
  | 'wheels.color'
  | 'wheels.caliperColor'
  | 'glass.tint'
  | 'lights.on'
  | 'lights.headlightColor'
  | 'stance.drop'
  | 'underglow.on'
  | 'underglow.color'
  | 'underglow.intensity'
  | 'environment'

export type ConfigValue = string | number | boolean

/** Reads a path out of a config snapshot. */
export function getPath(config: Config, path: ConfigPath): ConfigValue {
  const [head, tail] = path.split('.') as [keyof Config, string | undefined]
  const branch = config[head]
  if (tail === undefined) return branch as ConfigValue
  return (branch as unknown as Record<string, ConfigValue>)[tail]
}

export interface ConfigStore extends Config {
  setPaintColor: (slot: PaintSlot, color: string) => void
  setPaintFinish: (slot: PaintSlot, finish: Finish) => void
  setTwoTone: (twoTone: boolean) => void
  setWheels: (patch: Partial<WheelConfig>) => void
  setTint: (tint: number) => void
  setLights: (patch: Partial<LightsConfig>) => void
  setDrop: (drop: number) => void
  setUnderglow: (patch: Partial<UnderglowConfig>) => void
  setEnvironment: (environment: EnvironmentId) => void
  /** Generic setter for the schema-driven UI. Immutable, one level deep. */
  setPath: (path: ConfigPath, value: ConfigValue) => void
  reset: () => void
}

export const DEFAULT_CONFIG: Config = {
  paint1: { color: '#b3122a', finish: 'gloss' },
  paint2: { color: '#1a1c20', finish: 'gloss' },
  twoTone: false,
  wheels: { finish: 'gloss_black', color: '#2a2d31', caliperColor: '#8f1420' },
  glass: { tint: 0.35 },
  lights: { on: true, headlightColor: '#cfe4ff' },
  stance: { drop: 0 },
  underglow: { on: false, color: '#19c6ff', intensity: 0.6 },
  environment: 'garage',
}

export const useConfig = create<ConfigStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_CONFIG,
    setPaintColor: (slot, color) =>
      set((s) => ({ [slot]: { ...s[slot], color } }) as Partial<ConfigStore>),
    setPaintFinish: (slot, finish) =>
      set((s) => ({ [slot]: { ...s[slot], finish } }) as Partial<ConfigStore>),
    setTwoTone: (twoTone) => set({ twoTone }),
    setWheels: (patch) => set((s) => ({ wheels: { ...s.wheels, ...patch } })),
    setTint: (tint) => set((s) => ({ glass: { ...s.glass, tint } })),
    setLights: (patch) => set((s) => ({ lights: { ...s.lights, ...patch } })),
    setDrop: (drop) => set((s) => ({ stance: { ...s.stance, drop } })),
    setUnderglow: (patch) => set((s) => ({ underglow: { ...s.underglow, ...patch } })),
    setEnvironment: (environment) => set({ environment }),
    setPath: (path, value) =>
      set((state) => {
        const [head, tail] = path.split('.') as [keyof Config, string | undefined]
        if (tail === undefined) return { [head]: value } as unknown as Partial<ConfigStore>
        return {
          [head]: { ...(state[head] as object), [tail]: value },
        } as unknown as Partial<ConfigStore>
      }),
    reset: () => set(DEFAULT_CONFIG),
  })),
)

/** What paint2 should actually render as, given the two-tone toggle. */
export function effectivePaint(config: Config, slot: PaintSlot): PaintConfig {
  if (slot === 'paint2' && !config.twoTone) return config.paint1
  return config[slot]
}
