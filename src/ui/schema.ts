import type { MessageKey } from '../i18n/dictionary'
import type { Config, ConfigPath } from '../state/config'
import { ENVIRONMENTS } from '../three/environments'
import { FINISHES, RIM_FINISHES } from '../three/finishes'
import type { Option, SwatchOption } from './primitives'

/**
 * The entire configurator, as data.
 *
 * BRIEF §6: "Every row gets consistent spacing, RTL-correct layout and translation for
 * free. Adding a feature is 3 lines. Turns 2 days into ~6 hours."
 *
 * `path` is a typed union, so referencing a setting that does not exist is a compile
 * error rather than a control that silently does nothing. `when` handles conditional
 * rows — the secondary paint colour only exists when two-tone is on — without any
 * panel needing bespoke layout code.
 */

export type RowSpec =
  | { kind: 'swatches'; path: ConfigPath; labelKey: MessageKey; options: readonly SwatchOption[] }
  | { kind: 'segmented'; path: ConfigPath; labelKey: MessageKey; options: readonly Option[] }
  | { kind: 'toggle'; path: ConfigPath; labelKey: MessageKey }
  | { kind: 'color'; path: ConfigPath; labelKey: MessageKey }
  | {
      kind: 'slider'
      path: ConfigPath
      labelKey: MessageKey
      min: number
      max: number
      step: number
      /**
       * Takes the translator, because a formatted value is still text: "stock" and
       * "mm" are words, and a slider that reads `-40 mm` in an otherwise Arabic panel
       * is the kind of miss a `Record<MessageKey, string>` cannot catch.
       */
      format?: (v: number, t: Translator) => string
    }

export interface RowEntry {
  row: RowSpec
  /** Rows appear only when this returns true. */
  when?: (config: Config) => boolean
}

export interface PanelSpec {
  id: string
  labelKey: MessageKey
  rows: RowEntry[]
}

const PAINT_SWATCHES: readonly SwatchOption[] = [
  { name: 'Carmine', hex: '#b3122a' },
  { name: 'Graphite', hex: '#2b2f36' },
  { name: 'Pearl White', hex: '#e8e6e1' },
  { name: 'Jordan Blue', hex: '#12406b' },
  { name: 'Sand', hex: '#b39167' },
  { name: 'Forest', hex: '#1f4034' },
]

const FINISH_OPTIONS: readonly Option[] = FINISHES.map((f) => ({
  value: f,
  labelKey: `finish.${f}` as MessageKey,
}))

const RIM_OPTIONS: readonly Option[] = RIM_FINISHES.map((f) => ({
  value: f,
  labelKey: `rim.${f}` as MessageKey,
}))

const ENV_OPTIONS: readonly Option[] = ENVIRONMENTS.map((e) => ({
  value: e,
  labelKey: `env.${e}` as MessageKey,
}))

/** The translator, threaded into formatters. */
export type Translator = (key: MessageKey) => string

const percent = (v: number) => `${Math.round(v * 100)}%`

/**
 * Lowest the body can go before the splitter clips the floor. Measured: at 90 mm the
 * lowest body vertex reaches y = -0.0014.
 */
export const MAX_DROP = 0.085

export const PANELS: PanelSpec[] = [
  {
    id: 'paint',
    labelKey: 'panel.paint',
    rows: [
      { row: { kind: 'swatches', path: 'paint1.color', labelKey: 'paint.primary', options: PAINT_SWATCHES } },
      { row: { kind: 'segmented', path: 'paint1.finish', labelKey: 'paint.finish', options: FINISH_OPTIONS } },
      { row: { kind: 'toggle', path: 'twoTone', labelKey: 'paint.twoTone' } },
      {
        row: { kind: 'color', path: 'paint2.color', labelKey: 'paint.secondary' },
        when: (c) => c.twoTone,
      },
      {
        row: { kind: 'segmented', path: 'paint2.finish', labelKey: 'paint.finish', options: FINISH_OPTIONS },
        when: (c) => c.twoTone,
      },
    ],
  },
  {
    id: 'wheels',
    labelKey: 'panel.wheels',
    rows: [
      { row: { kind: 'segmented', path: 'wheels.finish', labelKey: 'wheels.finish', options: RIM_OPTIONS } },
      { row: { kind: 'color', path: 'wheels.color', labelKey: 'wheels.color' } },
      { row: { kind: 'color', path: 'wheels.caliperColor', labelKey: 'wheels.caliper' } },
    ],
  },
  {
    id: 'glass',
    labelKey: 'panel.glass',
    rows: [
      {
        row: {
          kind: 'slider',
          path: 'glass.tint',
          labelKey: 'glass.tint',
          min: 0,
          max: 1,
          step: 0.01,
          format: percent,
        },
      },
    ],
  },
  {
    id: 'stance',
    labelKey: 'panel.stance',
    rows: [
      {
        row: {
          kind: 'slider',
          path: 'stance.drop',
          labelKey: 'stance.drop',
          min: 0,
          max: MAX_DROP,
          step: 0.005,
          format: (v, t) => (v === 0 ? t('value.stock') : `-${Math.round(v * 1000)} ${t('unit.mm')}`),
        },
      },
    ],
  },
  {
    id: 'lights',
    labelKey: 'panel.lights',
    rows: [
      { row: { kind: 'toggle', path: 'lights.on', labelKey: 'lights.on' } },
      {
        row: { kind: 'color', path: 'lights.headlightColor', labelKey: 'lights.color' },
        when: (c) => c.lights.on,
      },
    ],
  },
  {
    id: 'scene',
    labelKey: 'panel.scene',
    rows: [
      { row: { kind: 'segmented', path: 'environment', labelKey: 'scene.preset', options: ENV_OPTIONS } },
      { row: { kind: 'toggle', path: 'underglow.on', labelKey: 'scene.underglow' } },
      {
        row: { kind: 'color', path: 'underglow.color', labelKey: 'scene.underglowColor' },
        when: (c) => c.underglow.on,
      },
      {
        row: {
          kind: 'slider',
          path: 'underglow.intensity',
          labelKey: 'scene.underglowIntensity',
          min: 0,
          max: 1,
          step: 0.05,
          format: percent,
        },
        when: (c) => c.underglow.on,
      },
    ],
  },
]
