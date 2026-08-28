import { useConfig } from '../state/config'
import { ENVIRONMENT_PRESETS, ENVIRONMENTS } from '../three/environments'
import { FINISHES, RIM_FINISHES } from '../three/finishes'

/**
 * TEMPORARY — day 6 replaces this with the schema-driven panel and its five control
 * primitives. It exists so the features are reachable without the debug flag.
 *
 * LOOKDEV §12 rule 4 still holds even here: colour swatches sit on a neutral mid-grey
 * chip, never on the dark glass, because against near-black every colour reads lighter
 * and more saturated than it actually is.
 */

const PAINT_PRESETS = [
  { name: 'Carmine', hex: '#b3122a' },
  { name: 'Graphite', hex: '#2b2f36' },
  { name: 'Pearl White', hex: '#e8e6e1' },
  { name: 'Jordan Blue', hex: '#12406b' },
  { name: 'Sand', hex: '#b39167' },
  { name: 'Forest', hex: '#1f4034' },
] as const

/**
 * Lowest the body can go before its splitter clips the floor. Measured: at 90 mm the
 * lowest body vertex reaches y = -0.0014, so this keeps a few millimetres in hand.
 */
const MAX_DROP = 0.085

const RIM_LABELS: Record<(typeof RIM_FINISHES)[number], string> = {
  silver: 'silver',
  gloss_black: 'gloss',
  matte_black: 'matte',
  gunmetal: 'gunmetal',
  chrome: 'chrome',
  bronze: 'bronze',
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 font-mono text-[10px] tracking-widest uppercase transition ${
        active
          ? 'bg-white/90 text-neutral-900'
          : 'text-neutral-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Swatch({
  color,
  onChange,
  label,
}: {
  color: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label
      className="h-6 w-6 shrink-0 cursor-pointer rounded-full ring-1 ring-white/25 hover:ring-white/60"
      style={{ backgroundColor: color }}
      title={label}
    >
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 first:border-0 first:pt-0">
      <span className="font-mono text-[9px] tracking-[0.2em] text-neutral-500 uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

export default function VehicleControls() {
  const c = useConfig()

  return (
    <div className="flex flex-col gap-3">
      <Section label="paint">
        {/* §12 rule 4: swatches on a neutral mid-grey chip, never on the dark panel. */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-500/25 p-2">
          {PAINT_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={p.hex.toLowerCase() === c.paint1.color.toLowerCase()}
              onClick={() => c.setPaintColor('paint1', p.hex)}
              style={{ backgroundColor: p.hex }}
              className={`h-7 w-7 rounded-full transition ${
                p.hex.toLowerCase() === c.paint1.color.toLowerCase()
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
              value={c.paint1.color}
              onChange={(e) => c.setPaintColor('paint1', e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom paint colour"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {FINISHES.map((f) => (
            <Chip
              key={f}
              active={f === c.paint1.finish}
              onClick={() => c.setPaintFinish('paint1', f)}
            >
              {f}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Chip active={c.twoTone} onClick={() => c.setTwoTone(!c.twoTone)}>
            two-tone
          </Chip>
          {c.twoTone && (
            <Swatch
              color={c.paint2.color}
              onChange={(v) => c.setPaintColor('paint2', v)}
              label="Secondary paint colour"
            />
          )}
        </div>
      </Section>

      <Section label="wheels">
        <div className="flex flex-wrap items-center gap-1">
          {RIM_FINISHES.map((f) => (
            <Chip key={f} active={f === c.wheels.finish} onClick={() => c.setWheels({ finish: f })}>
              {RIM_LABELS[f]}
            </Chip>
          ))}
          <Swatch
            color={c.wheels.caliperColor}
            onChange={(v) => c.setWheels({ caliperColor: v })}
            label="Caliper colour"
          />
        </div>
      </Section>

      <Section label={`window tint · ${Math.round(c.glass.tint * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={c.glass.tint}
          onChange={(e) => c.setTint(Number(e.target.value))}
          aria-label="Window tint"
          className="w-full accent-white"
        />
      </Section>

      <Section
        label={`ride height · ${
          c.stance.drop === 0 ? 'stock' : `${Math.round(c.stance.drop * 1000)} mm lower`
        }`}
      >
        <input
          type="range"
          min={0}
          max={MAX_DROP}
          step={0.005}
          value={c.stance.drop}
          onChange={(e) => c.setDrop(Number(e.target.value))}
          aria-label="Ride height"
          className="w-full accent-white"
        />
      </Section>

      <Section label="lights">
        <div className="flex items-center gap-2">
          <Chip active={c.lights.on} onClick={() => c.setLights({ on: !c.lights.on })}>
            {c.lights.on ? 'on' : 'off'}
          </Chip>
          <Swatch
            color={c.lights.headlightColor}
            onChange={(v) => c.setLights({ headlightColor: v })}
            label="Headlight colour"
          />
        </div>
      </Section>

      <Section label="underglow">
        <div className="flex items-center gap-2">
          <Chip active={c.underglow.on} onClick={() => c.setUnderglow({ on: !c.underglow.on })}>
            {c.underglow.on ? 'on' : 'off'}
          </Chip>
          <Swatch
            color={c.underglow.color}
            onChange={(v) => c.setUnderglow({ color: v })}
            label="Underglow colour"
          />
          {c.underglow.on && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={c.underglow.intensity}
              onChange={(e) => c.setUnderglow({ intensity: Number(e.target.value) })}
              aria-label="Underglow intensity"
              className="min-w-0 flex-1 accent-white"
            />
          )}
        </div>
      </Section>

      <Section label="scene">
        <div className="flex flex-wrap gap-1">
          {ENVIRONMENTS.map((id) => (
            <Chip key={id} active={id === c.environment} onClick={() => c.setEnvironment(id)}>
              {ENVIRONMENT_PRESETS[id].label}
            </Chip>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-neutral-500">
          {ENVIRONMENT_PRESETS[c.environment].description}
        </p>
      </Section>
    </div>
  )
}
