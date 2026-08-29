import { useConfig } from '../state/config'
import { useT } from '../state/lang'
import { evaluate, type RuleSource, type Severity } from '../rules/dvld'

/**
 * The Jordanian compliance readout — BRIEF §1.
 *
 * Not behind the progressive-disclosure accordion the controls use, because it is not
 * a control: it is the app answering back. Collapsing it would mean the one panel that
 * says "this fails inspection" is the one panel you have to go looking for.
 *
 * Every finding shows the authority it rests on. That is the difference between a
 * compliance feature and a coloured dot — see `rules/dvld.ts`.
 */

const DOT: Record<Severity, string> = {
  prohibited: 'bg-red-400',
  registration: 'bg-amber-400',
  permitted: 'bg-emerald-400',
}

const LABEL_KEY = {
  prohibited: 'compliance.prohibited',
  registration: 'compliance.registration',
  permitted: 'compliance.permitted',
} as const

const SOURCE_KEY: Record<RuleSource, 'compliance.source.dvld' | 'compliance.source.general'> = {
  dvld: 'compliance.source.dvld',
  general: 'compliance.source.general',
}

export default function Compliance() {
  const t = useT()
  const config = useConfig()
  const findings = evaluate(config)

  return (
    <section
      aria-label={t('compliance.title')}
      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/25 p-3"
    >
      <h2 className="font-mono text-[10px] tracking-[0.2em] text-neutral-400 uppercase">
        {t('compliance.title')}
      </h2>

      {findings.length === 0 ? (
        <p className="text-xs text-neutral-400">{t('compliance.clear')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {findings.map((rule) => (
            <li key={rule.id} className="flex gap-2.5">
              {/* Shape as well as colour: severity must survive a colourblind reader,
                  and the dot is the only thing distinguishing the three states. */}
              <span
                aria-hidden
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${DOT[rule.severity]}`}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs leading-snug text-neutral-100">
                  {t(rule.titleKey)}{' '}
                  <span className="text-neutral-500">· {t(LABEL_KEY[rule.severity])}</span>
                </p>
                <p className="text-[11px] leading-relaxed text-neutral-400">
                  {t(rule.detailKey)}
                </p>
                <p className="text-[10px] text-neutral-600">{t(SOURCE_KEY[rule.source])}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-white/5 pt-2 text-[10px] leading-relaxed text-neutral-600">
        {t('compliance.note')}
      </p>
    </section>
  )
}
