import type { EnvironmentId } from '../three/environments'
import type { Finish, RimFinish } from '../three/finishes'
import { DEFAULT_CONFIG, getPath, withPath, type Config, type ConfigPath, type ConfigValue } from './config'

/**
 * The URL codec — BRIEF §8, day 8, and the "de-facto schema of the whole config"
 * its critical-files list calls for.
 *
 * ## Shape
 *
 * One query parameter, `c`, holding `key-value` pairs joined by `.`:
 *
 *     ?c=p1c-2b2f36.p1f-m.gt-70.ev-n
 *
 * Query parameter, never a path segment. A path segment would need server-side
 * routing to survive a refresh; a static CDN has none. `?vin=` already works this
 * way for the same reason (see docs/DEPLOY.md).
 *
 * `-` and `.` are the two separators because they are the only punctuation that
 * `URLSearchParams.toString()` leaves alone. `~` and `:` read better but come back
 * as `%7E` and `%3A`, and a share link full of percent escapes looks broken in a
 * chat app even when it works. Every value is `[0-9a-z]` only, so `indexOf('-')`
 * splits a pair unambiguously.
 *
 * ## Rules
 *
 * **Defaults are omitted.** A default car produces no parameter at all, so the plain
 * URL stays clean and a short link means "close to stock".
 *
 * **Decoding never throws and never rejects wholesale.** A share link goes through
 * chat apps that truncate, and people hand-edit URLs. Each field validates on its
 * own: a bad one falls back to its default and every other field still lands. Losing
 * one setting is recoverable; a blank page or a thrown exception is not.
 *
 * **Enums encode as explicit letter codes, not list indices.** An index would make
 * reordering `FINISHES` silently repaint every link ever shared. The `Record<Finish,
 * string>` types below mean adding a finish without giving it a code is a compile
 * error, and `tools/check-codec.mjs` proves the codes stay unique.
 */

// ── Value codecs ─────────────────────────────────────────────────────────────

/**
 * `null` means "not representable" on the way out and "not valid" on the way in.
 * Both are handled by falling back to the default rather than failing the parse.
 */
interface Field {
  key: string
  encode: (value: ConfigValue) => string | null
  decode: (raw: string) => ConfigValue | null
  /** Present on numeric fields only. Read by the check script, which asserts it
   *  matches the slider that edits the same path. */
  range?: { min: number; max: number; step: number }
}

const HEX = /^[0-9a-f]{6}$/

function color(key: string): Field {
  return {
    key,
    encode: (v) => {
      const hex = String(v).replace(/^#/, '').toLowerCase()
      return HEX.test(hex) ? hex : null
    },
    decode: (raw) => {
      const hex = raw.toLowerCase()
      return HEX.test(hex) ? `#${hex}` : null
    },
  }
}

function flag(key: string): Field {
  return {
    key,
    encode: (v) => (v ? '1' : '0'),
    decode: (raw) => (raw === '1' ? true : raw === '0' ? false : null),
  }
}

/**
 * Numbers travel as integers in their natural unit — percent for the 0..1 sliders,
 * millimetres for ride height — so a share link never carries `0.35000000000000003`.
 *
 * Decoding clamps AND snaps to the slider's step. Snapping matters more than it
 * looks: `<input type="range">` sanitises its displayed value to the nearest step,
 * so an off-step number from a hand-edited URL would leave the handle sitting
 * somewhere the car is not.
 */
function quantity(key: string, min: number, max: number, step: number, scale: number): Field {
  const snap = (v: number) => Math.round(Math.round(v / step) * step * scale) / scale
  return {
    key,
    range: { min, max, step },
    encode: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n)) return null
      return String(Math.round(snap(Math.min(max, Math.max(min, n))) * scale))
    },
    decode: (raw) => {
      // Generous digit bound, then clamp. A tighter one made the outcome depend on how
      // many digits the nonsense had: `gt-200` clamped to a fully tinted window while
      // `gt-99999` fell back to the default. Same class of input, two answers.
      if (!/^\d{1,9}$/.test(raw)) return null
      const n = Number(raw) / scale
      return snap(Math.min(max, Math.max(min, n)))
    },
  }
}

/**
 * Codes are one letter and chosen by hand. `Record<E, string>` forces every member
 * of the union to have one; the check script forces them to be distinct.
 */
function enumField<E extends string>(key: string, codes: Record<E, string>): Field {
  const byCode = new Map(Object.entries(codes).map(([value, code]) => [code as string, value]))
  return {
    key,
    encode: (v) => codes[v as E] ?? null,
    decode: (raw) => byCode.get(raw) ?? null,
  }
}

const FINISH_CODES: Record<Finish, string> = {
  gloss: 'g',
  matte: 'm',
  satin: 's',
  flake: 'f',
  chrome: 'c',
  pearl: 'p',
}

const RIM_CODES: Record<RimFinish, string> = {
  silver: 's',
  gloss_black: 'g',
  matte_black: 'm',
  gunmetal: 'u',
  chrome: 'c',
  bronze: 'b',
}

const ENV_CODES: Record<EnvironmentId, string> = {
  garage: 'g',
  studio: 's',
  night: 'n',
}

// ── The schema ───────────────────────────────────────────────────────────────

/**
 * Every setting, exactly once.
 *
 * Typed `Record<ConfigPath, Field>`, so adding a path to the union without giving it
 * a codec is a compile error — the same trick that makes the UI schema safe. This is
 * the single enumeration of the config surface that BRIEF §8 asks for.
 *
 * The step and range arguments mirror `ui/schema.ts`. They are repeated rather than
 * imported because importing the UI schema would pull `three` into a module that is
 * otherwise pure data — and `tools/check-codec.mjs` asserts the two agree.
 */
const FIELDS: Record<ConfigPath, Field> = {
  'paint1.color': color('p1c'),
  'paint1.finish': enumField<Finish>('p1f', FINISH_CODES),
  'paint2.color': color('p2c'),
  'paint2.finish': enumField<Finish>('p2f', FINISH_CODES),
  twoTone: flag('tt'),
  'wheels.finish': enumField<RimFinish>('wf', RIM_CODES),
  'wheels.color': color('wc'),
  'wheels.caliperColor': color('wcc'),
  'glass.tint': quantity('gt', 0, 1, 0.01, 100),
  'lights.on': flag('lo'),
  'lights.headlightColor': color('lc'),
  'stance.drop': quantity('sd', 0, 0.085, 0.005, 1000),
  'underglow.on': flag('uo'),
  'underglow.color': color('uc'),
  'underglow.intensity': quantity('ui', 0, 1, 0.05, 100),
  environment: enumField<EnvironmentId>('ev', ENV_CODES),
}

export const CONFIG_PATHS = Object.keys(FIELDS) as ConfigPath[]

/** Exposed for the check script, which proves keys and enum codes are unique. */
export const CODEC_TABLES = { FIELDS, FINISH_CODES, RIM_CODES, ENV_CODES }

const BY_KEY = new Map(CONFIG_PATHS.map((path) => [FIELDS[path].key, path]))

/** The query parameter the encoded config lives in. */
export const CONFIG_PARAM = 'c'

// ── Encode / decode ──────────────────────────────────────────────────────────

/**
 * Serialises the non-default part of a config. Returns `''` for a stock car.
 *
 * Defaults are detected by comparing *encoded* forms rather than raw values, so
 * normalisation is applied once: `#B3122A` and `#b3122a` are the same car, and so
 * are a tint of `0.35` and one of `0.3500000000000001`.
 */
export function encodeConfig(config: Config): string {
  const parts: string[] = []
  for (const path of CONFIG_PATHS) {
    const field = FIELDS[path]
    const encoded = field.encode(getPath(config, path))
    if (encoded === null) continue
    if (encoded === field.encode(getPath(DEFAULT_CONFIG, path))) continue
    parts.push(`${field.key}-${encoded}`)
  }
  return parts.join('.')
}

/**
 * Rebuilds a config from an encoded string, filling anything missing or malformed
 * from the defaults. Total: every input maps to a valid `Config`.
 */
export function decodeConfig(encoded: string | null | undefined): Config {
  let config = DEFAULT_CONFIG
  if (!encoded) return config

  for (const part of encoded.split('.')) {
    const sep = part.indexOf('-')
    if (sep < 1) continue

    const path = BY_KEY.get(part.slice(0, sep))
    if (path === undefined) continue

    const value = FIELDS[path].decode(part.slice(sep + 1))
    if (value === null) continue

    config = withPath(config, path, value)
  }
  return config
}

// ── Location plumbing ────────────────────────────────────────────────────────

/**
 * The config encoded into a copy of `url`, leaving every other parameter — `vin`,
 * `debug` — untouched. A stock car removes the parameter rather than writing an
 * empty one.
 */
export function configToUrl(config: Config, url: URL): URL {
  const next = new URL(url)
  const encoded = encodeConfig(config)
  if (encoded) next.searchParams.set(CONFIG_PARAM, encoded)
  else next.searchParams.delete(CONFIG_PARAM)
  return next
}

/** The config described by a URL's query string. */
export function configFromUrl(url: URL): Config {
  return decodeConfig(url.searchParams.get(CONFIG_PARAM))
}
