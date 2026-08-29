import { configFromUrl, configToUrl } from './codec'
import { useConfig, type Config } from './config'

/**
 * Keeps the address bar and the configuration in step.
 *
 * Two halves, deliberately separate:
 *
 * `hydrateConfigFromUrl` runs in `main.tsx` **before** the first render. Doing it in
 * an effect instead would paint the default carmine car and then repaint it, which
 * is a visible flash on exactly the load that matters — the one someone opened from
 * a shared link.
 *
 * `startUrlSync` writes back afterwards, so the address bar is always a live
 * permalink and a refresh keeps your work.
 */

/** Long enough that dragging a slider writes once, short enough to feel immediate. */
const WRITE_DEBOUNCE_MS = 250

const currentUrl = () => new URL(window.location.href)

/** Applies `?c=` to the store. Safe to call before React mounts. */
export function hydrateConfigFromUrl(): void {
  if (typeof window === 'undefined') return
  useConfig.setState(configFromUrl(currentUrl()))
}

/**
 * Mirrors the store into `?c=` from here on. Returns an unsubscribe.
 *
 * `replaceState`, never `pushState`: a colour picker emits a value per pointer move,
 * and pushing each one would make the back button useless. Debounced on top of that,
 * because Safari rate-limits history writes and a slider drag can emit hundreds.
 *
 * Only the `c` parameter is touched — `vin` and `debug` are rewritten verbatim, and
 * the URL is re-read at write time rather than captured, so this and the VIN field
 * can both own their own parameter without clobbering each other.
 */
export function startUrlSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: number | undefined

  const write = (config: Config) => {
    const next = configToUrl(config, currentUrl())
    if (next.href !== window.location.href) window.history.replaceState(null, '', next)
  }

  const unsubscribe = useConfig.subscribe((state) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => write(state), WRITE_DEBOUNCE_MS)
  })

  return () => {
    window.clearTimeout(timer)
    unsubscribe()
  }
}

/**
 * The link to share: this page, with the current configuration encoded into it.
 *
 * Reads the store directly rather than waiting for the debounced address-bar write,
 * so the copied link is never one edit behind what is on screen.
 */
export function shareUrl(): string {
  return configToUrl(useConfig.getState(), currentUrl()).href
}
