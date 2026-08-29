import { useState } from 'react'

import { useT } from '../state/lang'
import type { VehicleState } from '../vin/useVehicle'

/**
 * TEMPORARY — day 6 folds this into the schema-driven panel.
 *
 * Its job is to make the VIN path visible: what was decoded, by whom, which 3D model
 * that selected, and — importantly — when the answer is a substitute rather than the
 * real thing. A configurator that silently shows the wrong shape is worse than one
 * that admits it.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
        {label}
      </span>
      <span className="text-xs text-neutral-100">{value}</span>
    </div>
  )
}

export default function VehiclePanel({
  vehicle,
  onSubmit,
}: {
  vehicle: VehicleState
  onSubmit: (vin: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(vehicle.vin ?? '')
  const { identity, model, status } = vehicle

  return (
    <div className="flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(draft)
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('vin.placeholder')}
          spellCheck={false}
          aria-label={t('vin.label')}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs tracking-wider text-neutral-100 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-white/90 px-3 py-1.5 font-mono text-[10px] tracking-widest text-neutral-900 uppercase transition hover:bg-white"
        >
          {t('vin.decode')}
        </button>
      </form>

      {status === 'invalid' && (
        <p className="mt-2 text-xs text-amber-400">
          {vehicle.problem === 'length' ? t('vin.badLength') : t('vin.badCharset')}
        </p>
      )}

      {status === 'loading' && (
        <p className="mt-2 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('vin.decoding')}
        </p>
      )}

      {status === 'error' && <p className="mt-2 text-xs text-amber-400">{vehicle.error}</p>}

      {status === 'ready' && identity && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Row
            label={t('vin.vehicle')}
            value={[identity.year, identity.make, identity.model].filter(Boolean).join(' ') || '—'}
          />
          {identity.series && <Row label={t('vin.series')} value={identity.series} />}
          {identity.bodyClass && <Row label={t('vin.body')} value={identity.bodyClass} />}
          {identity.doors !== null && <Row label={t('vin.doors')} value={String(identity.doors)} />}
          {identity.plantCountry && (
            <Row label={t('vin.builtIn')} value={identity.plantCountry} />
          )}

          {vehicle.problem === 'checkdigit' && (
            <p className="mt-1 text-[11px] leading-snug text-amber-400/90">
              {t('vin.checkDigit')}
            </p>
          )}

          <div className="mt-2 border-t border-white/10 pt-2">
            <Row label={t('vin.model3d')} value={model.entry.label} />
            {model.substituted && (
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                {t('vin.substituted')} &mdash; {model.reason}.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 border-t border-white/10 pt-2 text-center font-mono text-[9px] tracking-widest text-neutral-600 uppercase">
        {t('vin.decoder')} &middot; {vehicle.decoderName}
      </p>
    </div>
  )
}
