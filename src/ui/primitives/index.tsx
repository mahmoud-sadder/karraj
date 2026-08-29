import type { MessageKey } from '../../i18n/dictionary'
import { useT } from '../../state/lang'

/**
 * The five control primitives from BRIEF §6.
 *
 * The argument for building these rather than hand-writing panels: 11 features across
 * two languages and two form factors is roughly 40 controls, and writing each one by
 * hand produces two days of work and inconsistent spacing. Five primitives rendered
 * from a declarative array give every row the same spacing, the same RTL behaviour and
 * the same translation path for free, and adding a feature becomes three lines.
 *
 * Everything here is laid out with CSS **logical properties** — `ms-`/`me-`, `ps-`/`pe-`,
 * `text-start`, `justify-between` — never `left`/`right`. Day 9 flips `dir` to RTL for
 * Arabic, and the brief warns that the fixed canvas plus side panel is the thing most
 * likely to break under it. Logical properties mean there is nothing to flip.
 */

export interface Option<T extends string = string> {
  value: T
  labelKey: MessageKey
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-start font-mono text-[9px] tracking-[0.18em] text-neutral-500 uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

// ── 1. Toggle ────────────────────────────────────────────────────────────────

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-start text-xs text-neutral-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          value ? 'bg-white/90' : 'bg-white/15'
        }`}
      >
        {/* `start-*` rather than `left-*`, so the knob travels the correct way in RTL. */}
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
            value ? 'start-[1.125rem] bg-neutral-900' : 'start-0.5 bg-neutral-400'
          }`}
        />
      </button>
    </div>
  )
}

// ── 2. Segmented ─────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (v: T) => void
}) {
  const t = useT()
  return (
    <Row label={label}>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2 py-1 text-[11px] transition ${
              o.value === value
                ? 'bg-white/90 text-neutral-900'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>
    </Row>
  )
}

// ── 3. Slider ────────────────────────────────────────────────────────────────

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <Row
      label={
        <>
          {label}
          {/* `<bdi>` isolates the value from the surrounding paragraph direction. A
              formatted value is a run of digits and punctuation with no strong
              direction of its own, so in an RTL panel the bidi algorithm is free to
              reorder it — which is exactly how "9 / 10" elsewhere rendered as
              "10 / 9". */}
          {format && (
            <>
              {' · '}
              <bdi>{format(value)}</bdi>
            </>
          )}
        </>
      }
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </Row>
  )
}

// ── 4. ColorField ────────────────────────────────────────────────────────────

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-start text-xs text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-neutral-500 uppercase">{value}</span>
        <label
          className="h-6 w-6 shrink-0 cursor-pointer rounded-full ring-1 ring-white/25 hover:ring-white/60"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-6 cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
      </span>
    </div>
  )
}

// ── 5. Swatches ──────────────────────────────────────────────────────────────

export interface SwatchOption {
  name: string
  hex: string
}

export function Swatches({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly SwatchOption[]
  onChange: (v: string) => void
}) {
  return (
    <Row label={label}>
      {/* LOOKDEV §12 rule 4: swatches sit on a neutral mid-grey chip, never on the dark
          panel — against near-black every colour reads lighter and more saturated than
          it is, which for a paint picker is a lie. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-500/25 p-2">
        {options.map((o) => (
          <button
            key={o.hex}
            type="button"
            title={o.name}
            aria-label={o.name}
            aria-pressed={o.hex.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(o.hex)}
            style={{ backgroundColor: o.hex }}
            className={`h-7 w-7 rounded-full transition ${
              o.hex.toLowerCase() === value.toLowerCase()
                ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-500/40'
                : 'ring-1 ring-white/25 hover:ring-white/60'
            }`}
          />
        ))}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/25 hover:ring-white/60">
          <span
            className="block h-full w-full"
            style={{ background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label} — custom`}
          />
        </label>
      </div>
    </Row>
  )
}
