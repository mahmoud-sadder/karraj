import { useState } from 'react'

import { t } from '../i18n/dictionary'
import { getPath, useConfig, type ConfigValue } from '../state/config'
import { ColorField, Segmented, Slider, Swatches, Toggle } from './primitives'
import { PANELS, type RowSpec } from './schema'

/**
 * Renders the whole configurator from `schema.ts`.
 *
 * This component knows nothing about paint, wheels or glass — it maps row kinds to
 * primitives and reads and writes by path. Adding a feature means adding three lines to
 * the schema; nothing here changes.
 *
 * Progressive disclosure per LOOKDEV §12 rule 7 — one category open at a time, the
 * Koenigsegg pattern. On a phone the alternative is a 40-control wall that pushes the
 * car off screen.
 */

function Control({ row }: { row: RowSpec }) {
  const value = useConfig((s) => getPath(s, row.path))
  const setPath = useConfig((s) => s.setPath)
  const set = (v: ConfigValue) => setPath(row.path, v)
  const label = t(row.labelKey)

  switch (row.kind) {
    case 'swatches':
      return (
        <Swatches label={label} value={value as string} options={row.options} onChange={set} />
      )
    case 'segmented':
      return (
        <Segmented label={label} value={value as string} options={row.options} onChange={set} />
      )
    case 'toggle':
      return <Toggle label={label} value={value as boolean} onChange={set} />
    case 'color':
      return <ColorField label={label} value={value as string} onChange={set} />
    case 'slider':
      return (
        <Slider
          label={label}
          value={value as number}
          min={row.min}
          max={row.max}
          step={row.step}
          format={row.format}
          onChange={set}
        />
      )
  }
}

export default function ConfigPanel() {
  const config = useConfig()
  const [open, setOpen] = useState<string>(PANELS[0].id)

  return (
    <div className="flex flex-col gap-1">
      {PANELS.map((panel) => {
        const isOpen = panel.id === open
        // `when` is evaluated here so an empty panel could be hidden entirely later.
        const rows = panel.rows.filter((r) => !r.when || r.when(config))

        return (
          <section key={panel.id} className="border-t border-white/10 first:border-0">
            <h2>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`panel-${panel.id}`}
                onClick={() => setOpen(isOpen ? '' : panel.id)}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-start"
              >
                <span
                  className={`font-mono text-[10px] tracking-[0.2em] uppercase transition ${
                    isOpen ? 'text-neutral-100' : 'text-neutral-500'
                  }`}
                >
                  {t(panel.labelKey)}
                </span>
                {/* Rotates rather than swapping glyphs, so it reads the same in RTL. */}
                <span
                  aria-hidden
                  className={`text-neutral-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                >
                  +
                </span>
              </button>
            </h2>

            {isOpen && (
              <div id={`panel-${panel.id}`} className="flex flex-col gap-3 pb-4">
                {rows.map((entry) => (
                  <Control key={entry.row.path + entry.row.kind} row={entry.row} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
