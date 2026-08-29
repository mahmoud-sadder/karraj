import { useMemo } from 'react'
import { create } from 'zustand'

import { DIRECTION, LANGS, translate, type Lang, type MessageKey } from '../i18n/dictionary'

/**
 * The current language, and the plumbing that makes the rest of the document follow it.
 *
 * Three things have to move together, and they are easy to get half-right:
 *
 *   - `<html lang>`, which is what the Arabic font stack and the letter-spacing reset
 *     in `index.css` key off, and what a screen reader uses to pick a voice.
 *   - `<html dir>`, which flips every logical property in the UI at once.
 *   - the camera, which cannot infer a direction from a projection offset and is told
 *     separately — `useDirection` observes the attribute rather than reading it once.
 *
 * So the store owns the attribute, and everything else observes the attribute. That
 * ordering matters: setting state first and the attribute later meant one frame where
 * the panel had flipped and the car had not.
 */

const PARAM = 'lang'

const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang)

/**
 * `?lang=` if present, otherwise the browser's own preference.
 *
 * Arabic-first by default when the browser is Arabic — Carseer's market is, and a
 * configurator that opens in English for an Arabic speaker has already made its point
 * badly. Matching on the primary subtag means `ar-JO`, `ar-SA` and bare `ar` all land.
 */
function preferredLanguage(): Lang {
  if (typeof window === 'undefined') return 'en'

  const fromUrl = new URLSearchParams(window.location.search).get(PARAM)
  if (isLang(fromUrl)) return fromUrl

  for (const tag of navigator.languages ?? [navigator.language]) {
    const primary = tag.toLowerCase().split('-')[0]
    if (isLang(primary)) return primary
  }
  return 'en'
}

function applyToDocument(lang: Lang): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = lang
  root.dir = DIRECTION[lang]
}

interface LangStore {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLang = create<LangStore>()((set) => ({
  lang: 'en',
  setLang: (lang) => {
    applyToDocument(lang)
    // Only an explicit switch writes the parameter. Hydrating from `navigator` must
    // not, or every Arabic browser would silently rewrite the URL it was given.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set(PARAM, lang)
      window.history.replaceState(null, '', url)
    }
    set({ lang })
  },
}))

/**
 * Applies the starting language. Called from `main.tsx` before the first render, for
 * the same reason the config codec is: rendering English and then flipping to Arabic
 * is a visible lurch on precisely the load where it matters.
 */
export function hydrateLanguage(): void {
  const lang = preferredLanguage()
  applyToDocument(lang)
  useLang.setState({ lang })
}

/** The translator for the current language. Re-renders its caller when that changes. */
export function useT(): (key: MessageKey) => string {
  const lang = useLang((s) => s.lang)
  return useMemo(() => (key: MessageKey) => translate(lang, key), [lang])
}
