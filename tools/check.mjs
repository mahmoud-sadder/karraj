#!/usr/bin/env node
/**
 * Proves the pure modules that cannot be eyeballed.
 *
 * These are the pieces whose failures are invisible. A link that decodes to a slightly
 * different car looks like a working link. A layout function that returns NaN for a
 * zero-size viewport looks like correct arithmetic right up until the camera lands at
 * NaN and the canvas goes black — which is exactly what it did, on the day this file
 * grew a layout section. There is no render to eyeball and no exception to catch, so
 * they get an assertion pass instead: the same treatment `prepare-car.mjs` gives the
 * asset.
 *
 * TypeScript is bundled through esbuild (already present as a Vite dependency) rather
 * than run through a loader, because the modules under test use extensionless imports
 * that Node's ESM resolver will not follow.
 *
 * Run: npm run check
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'tools', '.cache')

// ── Build ────────────────────────────────────────────────────────────────────

mkdirSync(CACHE, { recursive: true })
const entry = join(CACHE, 'codec-entry.mjs')
const bundle = join(CACHE, 'codec-bundle.mjs')

writeFileSync(
  entry,
  [
    `export * from '../../src/state/codec.ts'`,
    `export { DEFAULT_CONFIG, getPath } from '../../src/state/config.ts'`,
    `export { PANELS } from '../../src/ui/schema.ts'`,
    `export { viewLayout, RAIL_WIDTH, MD_BREAKPOINT } from '../../src/ui/layout.ts'`,
    '',
  ].join('\n'),
)

execFileSync(
  join(ROOT, 'node_modules', '.bin', 'esbuild'),
  [entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${bundle}`, '--log-level=warning'],
  { stdio: 'inherit' },
)

const {
  encodeConfig,
  decodeConfig,
  configToUrl,
  configFromUrl,
  CONFIG_PATHS,
  CONFIG_PARAM,
  CODEC_TABLES,
  DEFAULT_CONFIG,
  getPath,
  PANELS,
  viewLayout,
  RAIL_WIDTH,
  MD_BREAKPOINT,
} = await import(pathToFileURL(bundle).href)

const { FIELDS, FINISH_CODES, RIM_CODES, ENV_CODES } = CODEC_TABLES

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0
const failures = []

function check(label, fn) {
  try {
    const note = fn()
    passed += 1
    console.log(`  ok   ${label}${note ? ` — ${note}` : ''}`)
  } catch (error) {
    failures.push({ label, error })
    console.log(`  FAIL ${label}\n       ${error.message.split('\n')[0]}`)
  }
}

/** Deterministic, so a failure reproduces exactly. */
function lcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const setIn = (config, path, value) => {
  const [head, tail] = path.split('.')
  const next = structuredClone(config)
  if (tail === undefined) next[head] = value
  else next[head][tail] = value
  return next
}

/** Every value each field can legally hold. */
function domain(path) {
  const field = FIELDS[path]
  if (field.range) {
    const { min, max, step } = field.range
    const out = []
    for (let n = 0; n <= Math.round((max - min) / step); n += 1) {
      out.push(Math.round((min + n * step) * 1e6) / 1e6)
    }
    return out
  }
  const current = getPath(DEFAULT_CONFIG, path)
  if (typeof current === 'boolean') return [true, false]
  if (typeof current === 'string' && current.startsWith('#')) {
    return ['#000000', '#ffffff', '#b3122a', '#0f1a2b', '#abcdef', current]
  }
  // Enum: recover the members from whichever code table this field's encoder accepts.
  for (const table of [FINISH_CODES, RIM_CODES, ENV_CODES]) {
    const members = Object.keys(table)
    if (field.encode(members[0]) !== null) return members
  }
  throw new Error(`no domain for ${path}`)
}

const DOMAINS = Object.fromEntries(CONFIG_PATHS.map((p) => [p, domain(p)]))

function randomConfig(rand) {
  let config = DEFAULT_CONFIG
  for (const path of CONFIG_PATHS) {
    const values = DOMAINS[path]
    config = setIn(config, path, values[Math.floor(rand() * values.length)])
  }
  return config
}

// ── 1. Table integrity ───────────────────────────────────────────────────────

console.log('\ntable integrity')

check('every config path has a codec', () => {
  assert.equal(CONFIG_PATHS.length, Object.keys(FIELDS).length)
  return `${CONFIG_PATHS.length} paths`
})

check('parameter keys are unique', () => {
  const keys = CONFIG_PATHS.map((p) => FIELDS[p].key)
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${keys.join(', ')}`)
  return keys.join(' ')
})

check('parameter keys need no percent-encoding', () => {
  for (const path of CONFIG_PATHS) {
    assert.match(FIELDS[path].key, /^[a-z0-9]{2,3}$/, `${path} key "${FIELDS[path].key}"`)
  }
})

for (const [name, table] of [
  ['finish', FINISH_CODES],
  ['rim', RIM_CODES],
  ['environment', ENV_CODES],
]) {
  check(`${name} codes are unique`, () => {
    const codes = Object.values(table)
    assert.equal(new Set(codes).size, codes.length, `duplicate in ${JSON.stringify(table)}`)
    for (const code of codes) assert.match(code, /^[a-z0-9]$/)
    return `${codes.length} codes`
  })
}

// ── 2. The codec agrees with the UI ──────────────────────────────────────────

console.log('\nagreement with ui/schema.ts')

const sliderRows = PANELS.flatMap((panel) => panel.rows.map((r) => r.row)).filter(
  (row) => row.kind === 'slider',
)

check('every slider has a numeric codec with the same range', () => {
  assert.ok(sliderRows.length > 0, 'no sliders found in the schema')
  for (const row of sliderRows) {
    const range = FIELDS[row.path]?.range
    assert.ok(range, `${row.path} is a slider but its codec is not numeric`)
    assert.deepEqual(
      { min: range.min, max: range.max, step: range.step },
      { min: row.min, max: row.max, step: row.step },
      `${row.path} range drifted from the slider`,
    )
  }
  return `${sliderRows.length} sliders`
})

check('every numeric codec is edited by a slider', () => {
  const numeric = CONFIG_PATHS.filter((p) => FIELDS[p].range)
  const edited = new Set(sliderRows.map((r) => r.path))
  for (const path of numeric) assert.ok(edited.has(path), `${path} has a range but no slider`)
})

// ── 3. Round-tripping ────────────────────────────────────────────────────────

console.log('\nround-trip')

check('a stock car encodes to nothing', () => {
  assert.equal(encodeConfig(DEFAULT_CONFIG), '')
  assert.deepEqual(decodeConfig(''), DEFAULT_CONFIG)
  assert.deepEqual(decodeConfig(null), DEFAULT_CONFIG)
})

check('every value of every field, one at a time', () => {
  let count = 0
  for (const path of CONFIG_PATHS) {
    for (const value of DOMAINS[path]) {
      const config = setIn(DEFAULT_CONFIG, path, value)
      assert.deepEqual(
        decodeConfig(encodeConfig(config)),
        config,
        `${path} = ${JSON.stringify(value)} did not survive`,
      )
      count += 1
    }
  }
  return `${count} values`
})

check('random whole configurations', () => {
  const rand = lcg(20260829)
  for (let i = 0; i < 5000; i += 1) {
    const config = randomConfig(rand)
    assert.deepEqual(decodeConfig(encodeConfig(config)), config, `iteration ${i}`)
  }
  return '5000 configurations'
})

check('encoding is idempotent', () => {
  const rand = lcg(7)
  for (let i = 0; i < 500; i += 1) {
    const encoded = encodeConfig(randomConfig(rand))
    assert.equal(encodeConfig(decodeConfig(encoded)), encoded)
  }
})

// ── 4. It survives being a URL ───────────────────────────────────────────────

console.log('\nurl safety')

check('encoded configs pass through URLSearchParams untouched', () => {
  const rand = lcg(11)
  let longest = 0
  for (let i = 0; i < 500; i += 1) {
    const encoded = encodeConfig(randomConfig(rand))
    const query = new URLSearchParams({ [CONFIG_PARAM]: encoded }).toString()
    assert.equal(
      query,
      `${CONFIG_PARAM}=${encoded}`,
      `percent-encoded: ${query}`,
    )
    longest = Math.max(longest, encoded.length)
  }
  return `longest ${longest} chars`
})

check('other query parameters survive a write', () => {
  const url = new URL('https://karraj.pages.dev/?vin=WBANE535X7CW65098&debug=1')
  const written = configToUrl(setIn(DEFAULT_CONFIG, 'glass.tint', 0.7), url)
  assert.equal(written.searchParams.get('vin'), 'WBANE535X7CW65098')
  assert.equal(written.searchParams.get('debug'), '1')
  assert.deepEqual(configFromUrl(written), setIn(DEFAULT_CONFIG, 'glass.tint', 0.7))
  return written.search
})

check('a stock car removes the parameter rather than emptying it', () => {
  const url = new URL('https://karraj.pages.dev/?c=gt-70&vin=X')
  const written = configToUrl(DEFAULT_CONFIG, url)
  assert.equal(written.searchParams.has(CONFIG_PARAM), false)
  assert.equal(written.searchParams.get('vin'), 'X')
})

// ── 5. It survives being abused ──────────────────────────────────────────────

console.log('\nmalformed input')

/** A config is well-formed iff it is exactly what the codec would produce for it. */
const wellFormed = (config) => {
  assert.deepEqual(decodeConfig(encodeConfig(config)), config)
  assert.equal(Object.keys(config).length, Object.keys(DEFAULT_CONFIG).length)
}

check('adversarial strings decode to a valid configuration', () => {
  const rand = lcg(99)
  const junk = Array.from({ length: 200 }, () =>
    Array.from({ length: Math.floor(rand() * 60) }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789-.#%&='.charAt(Math.floor(rand() * 41)),
    ).join(''),
  )
  const cases = [
    '',
    '.',
    '-',
    '..--..',
    'p1c',
    'p1c-',
    '-p1c-ffffff',
    'p1c-zzzzzz',
    'p1c-fff',
    'p1c-FFFFFF',
    'gt-99999',
    'gt--5',
    'gt-1e3',
    'sd-83',
    'zz-1',
    'tt-2',
    'ev-q',
    'p1f-G',
    `p1c-${'f'.repeat(10000)}`,
    'gt-50.gt-70',
    ...junk,
  ]
  for (const input of cases) {
    let config
    assert.doesNotThrow(() => {
      config = decodeConfig(input)
    }, `threw on ${JSON.stringify(input.slice(0, 40))}`)
    wellFormed(config)
  }
  return `${cases.length} inputs`
})

check('uppercase hex and out-of-range numbers are repaired, not dropped', () => {
  assert.equal(decodeConfig('p1c-FFFFFF').paint1.color, '#ffffff')
  assert.equal(decodeConfig('gt-99999').glass.tint, 1)
  // 83 mm is not on the 5 mm step; the slider handle has to be able to sit where the
  // car actually is, so it snaps rather than passing through.
  assert.equal(decodeConfig('sd-83').stance.drop, 0.085)
  assert.equal(decodeConfig('sd-42').stance.drop, 0.04)
})

check('a truncated link still shows a car', () => {
  const rand = lcg(4242)
  for (let i = 0; i < 200; i += 1) {
    const encoded = encodeConfig(randomConfig(rand))
    for (let cut = 0; cut <= encoded.length; cut += 1) {
      wellFormed(decodeConfig(encoded.slice(0, cut)))
    }
  }
  return 'every prefix of 200 links'
})

check('an unknown key is ignored, and its neighbours still land', () => {
  const config = decodeConfig('zz-9.gt-70.qq-abc.ev-n')
  assert.equal(config.glass.tint, 0.7)
  assert.equal(config.environment, 'night')
})

// ── 6. Layout ────────────────────────────────────────────────────────────────

console.log('\nviewport layout')

const VIEWPORTS = [
  [0, 0],
  [1, 1],
  [1, 900],
  [900, 1],
  [320, 480],
  [375, 812],
  [768, 1024],
  [1280, 720],
  [1600, 900],
  [3840, 2160],
  [MD_BREAKPOINT, MD_BREAKPOINT],
  [RAIL_WIDTH, RAIL_WIDTH],
]

check('every viewport yields finite, positive framing tangents', () => {
  for (const [width, height] of VIEWPORTS) {
    for (const rtl of [false, true]) {
      const v = viewLayout(width, height, 30, rtl)
      for (const key of ['tanHalfH', 'tanHalfV']) {
        assert.ok(
          Number.isFinite(v[key]) && v[key] > 0,
          `${width}x${height} rtl=${rtl}: ${key} = ${v[key]}`,
        )
      }
    }
  }
  return `${VIEWPORTS.length * 2} cases`
})

check('the uncovered area is never empty and never off-canvas', () => {
  for (const [width, height] of VIEWPORTS) {
    for (const rtl of [false, true]) {
      const v = viewLayout(width, height, 30, rtl)
      const label = `${width}x${height} rtl=${rtl}`
      assert.ok(v.freeWidth >= 1, `${label}: freeWidth ${v.freeWidth}`)
      assert.ok(v.freeHeight >= 1, `${label}: freeHeight ${v.freeHeight}`)
      assert.ok(v.freeX >= 0 && v.freeY >= 0, `${label}: origin behind the canvas`)
      assert.ok(
        v.freeX + v.freeWidth <= Math.max(1, width) + 0.001,
        `${label}: free area runs past the right edge`,
      )
      assert.ok(
        v.freeY + v.freeHeight <= Math.max(1, height) + 0.001,
        `${label}: free area runs past the bottom edge`,
      )
    }
  }
})

check('the rail is on the trailing edge, and the shift follows it', () => {
  const desktop = [1600, 900]
  const ltr = viewLayout(...desktop, 30, false)
  const rtl = viewLayout(...desktop, 30, true)

  // LTR: rail on the right, so the free area starts at the left edge.
  assert.equal(ltr.freeX, 0)
  // RTL: rail on the left, so the free area starts past it.
  assert.equal(rtl.freeX, 1600 - rtl.freeWidth)
  // Same amount of canvas either way, mirrored.
  assert.equal(ltr.freeWidth, rtl.freeWidth)
  assert.equal(ltr.offsetX, -rtl.offsetX)

  // The export crop is the free area expressed in the shifted frame's coordinates,
  // and by symmetry it lands in the same place in both directions.
  assert.equal(ltr.offsetX + ltr.freeX, rtl.offsetX + rtl.freeX)
  return `crop x = ${ltr.offsetX + ltr.freeX}`
})

check('a phone gets a sheet and no rail; a desktop the reverse', () => {
  const phone = viewLayout(375, 812, 30, false)
  assert.equal(phone.freeWidth, 375, 'a rail on a phone would be the whole screen')
  assert.ok(phone.freeHeight < 812, 'the bottom sheet should be taking height')

  const desktop = viewLayout(1600, 900, 30, false)
  assert.equal(desktop.freeHeight, 900, 'no sheet on desktop')
  assert.equal(desktop.freeWidth, 1600 - RAIL_WIDTH)
})

// ── Report ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const { label, error } of failures) console.error(`\n${label}\n${error.stack}`)
  process.exit(1)
}
