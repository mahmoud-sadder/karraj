import { useConfig } from '../state/config'
import { FINISHES, RIM_FINISHES } from '../three/finishes'

/**
 * TEMPORARY — day 6 replaces this with the schema-driven panel and its five control
 * primitives. It exists so day 4's features are reachable without the debug flag.
 *
 * LOOKDEV §12's rule still holds even here: colour swatches sit on a neutral mid-grey
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
        active ? 'bg-white/90 text-neutral-900' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
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
    <div className="pointer-events-auto flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border border-white/10 bg-neutral-500/15 p-3 backdrop-blur-xl">
      <Section label="paint">
        <div className="flex flex-wrap items-center gap-2">
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
              style={{
                background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
              }}
            />
            <input
              type="color"
              value={c.paint1.color}
              onChange={(e) => c.setPaintColor('paint1', e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom paint colour"
            />
          </label>
          <Chip active={c.twoTone} onClick={() => c.setTwoTone(!c.twoTone)}>
            two-tone
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1">
          {FINISHES.map((f) => (
            <Chip key={f} active={f === c.paint1.finish} onClick={() => c.setPaintFinish('paint1', f)}>
              {f}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="wheels">
        <div className="flex flex-wrap items-center gap-1">
          {RIM_FINISHES.map((f) => (
            <Chip key={f} active={f === c.wheels.finish} onClick={() => c.setWheels({ finish: f })}>
              {RIM_LABELS[f]}
            </Chip>
          ))}
          <label
            className="ml-1 h-6 w-6 cursor-pointer rounded-full ring-1 ring-white/25"
            style={{ backgroundColor: c.wheels.caliperColor }}
            title="Caliper colour"
          >
            <input
              type="color"
              value={c.wheels.caliperColor}
              onChange={(e) => c.setWheels({ caliperColor: e.target.value })}
              className="h-6 w-6 cursor-pointer opacity-0"
              aria-label="Caliper colour"
            />
          </label>
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

      <Section label="lights">
        <div className="flex items-center gap-2">
          <Chip active={c.lights.on} onClick={() => c.setLights({ on: !c.lights.on })}>
            {c.lights.on ? 'on' : 'off'}
          </Chip>
          <label
            className="h-6 w-6 cursor-pointer rounded-full ring-1 ring-white/25"
            style={{ backgroundColor: c.lights.headlightColor }}
            title="Headlight colour"
          >
            <input
              type="color"
              value={c.lights.headlightColor}
              onChange={(e) => c.setLights({ headlightColor: e.target.value })}
              className="h-6 w-6 cursor-pointer opacity-0"
              aria-label="Headlight colour"
            />
          </label>
        </div>
      </Section>
    </div>
  )
}
