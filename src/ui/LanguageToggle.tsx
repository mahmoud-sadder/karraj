import { useLang } from '../state/lang'
import { useT } from '../state/lang'

/**
 * English ⇄ العربية.
 *
 * Labelled with the language it switches *to*, written in that language — the one
 * convention a bilingual user can read without already knowing which mode they are in.
 */
export default function LanguageToggle() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)

  return (
    <button
      type="button"
      aria-label={t('lang.label')}
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 transition hover:border-white/30 hover:text-white"
    >
      {t('lang.switch')}
    </button>
  )
}
