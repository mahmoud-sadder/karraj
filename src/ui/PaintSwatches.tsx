import { useConfig } from '../state/config'
import { FINISHES } from '../three/finishes'

/**
 * TEMPORARY — day 6 replaces this with the schema-driven panel and its five control
 * primitives (BRIEF §6). It exists to prove the day-2 milestone: the store drives the
 * material map, and the paint changes at 60fps without re-rendering the scene.
 *
 * One rule from LOOKDEV §12 is worth honouring even here: swatches sit on a neutral
 * mid-grey chip, never on the dark glass. Against a near-black panel every colour
 * reads lighter and more saturated than it is, which for a paint picker is a lie.
 */

const PRESETS = [
  { name: 'Carmine', hex: '#b3122a' },
  { name: 'Graphite', hex: '#2b2f36' },
  { name: 'Pearl White', hex: '#e8e6e1' },
  { name: 'Jordan Blue', hex: '#12406b' },
  { name: 'Sand', hex: '#b39167' },
  { name: 'Forest', hex: '#1f4034' },
] as const

export default function PaintSwatches() {
  const color = useConfig((s) => s.paint1.color)
  const finish = useConfig((s) => s.paint1.finish)
  const twoTone = useConfig((s) => s.twoTone)
  const color2 = useConfig((s) => s.paint2.color)
  const setPaintColor = useConfig((s) => s.setPaintColor)
  const setPaintFinish = useConfig((s) => s.setPaintFinish)
  const setTwoTone = useConfig((s) => s.setTwoTone)

  return (
    <div className="pointer-events-auto flex flex-col gap-3 rounded-xl border border-white/10 bg-neutral-500/15 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {PRESETS.map((preset) => {
          const active = preset.hex.toLowerCase() === color.toLowerCase()
          return (
            <button
              key={preset.hex}
              type="button"
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={active}
              onClick={() => setPaintColor('paint1', preset.hex)}
              style={{ backgroundColor: preset.hex }}
              className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-neutral-500/40 transition ${
                active ? 'ring-2 ring-white' : 'ring-1 ring-white/25 hover:ring-white/60'
              }`}
            />
          )
        })}

        <label className="relative ml-1 h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/25 hover:ring-white/60">
          <span
            className="block h-full w-full"
            style={{
              background:
                'conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
            }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setPaintColor('paint1', e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom paint colour"
          />
        </label>
      </div>

      <div className="flex justify-center gap-1">
        {FINISHES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setPaintFinish('paint1', f)}
            aria-pressed={f === finish}
            className={`rounded-md px-2 py-1 font-mono text-[10px] tracking-widest uppercase transition ${
              f === finish
                ? 'bg-white/90 text-neutral-900'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 pt-2">
        <button
          type="button"
          onClick={() => setTwoTone(!twoTone)}
          aria-pressed={twoTone}
          className={`rounded-md px-2 py-1 font-mono text-[10px] tracking-widest uppercase transition ${
            twoTone ? 'bg-white/90 text-neutral-900' : 'text-neutral-300 hover:bg-white/10'
          }`}
        >
          two-tone
        </button>

        {twoTone && (
          <label className="flex cursor-pointer items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-neutral-300 uppercase">
              second
            </span>
            <span
              className="block h-6 w-6 rounded-full ring-1 ring-white/25"
              style={{ backgroundColor: color2 }}
            >
              <input
                type="color"
                value={color2}
                onChange={(e) => setPaintColor('paint2', e.target.value)}
                className="h-6 w-6 cursor-pointer opacity-0"
                aria-label="Secondary paint colour"
              />
            </span>
          </label>
        )}
      </div>

      <p className="text-center font-mono text-[10px] tracking-widest text-neutral-300 uppercase">
        paint1 &middot; {color} &middot; {finish}
      </p>
    </div>
  )
}
