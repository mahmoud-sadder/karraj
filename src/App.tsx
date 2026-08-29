import { lazy, Suspense, useCallback, useState } from 'react'

import { isDebug } from './state/art'
import { useT } from './state/lang'
import Scene from './three/Scene'
import Compliance from './ui/Compliance'
import ConfigPanel from './ui/ConfigPanel'
import Credits from './ui/Credits'
import LanguageToggle from './ui/LanguageToggle'
import Loading from './ui/Loading'
import Rail from './ui/Rail'
import ShareBar from './ui/ShareBar'
import VehiclePanel from './ui/VehiclePanel'
import { useVehicle, vinFromUrl } from './vin/useVehicle'

/**
 * Lazy so leva never lands in the production bundle — Vite splits it into its own
 * chunk that is only fetched when `?debug=1` is present.
 */
const DebugPanel = lazy(() => import('./debug/DebugPanel'))

export default function App() {
  const t = useT()
  const [vin, setVin] = useState<string | null>(() => vinFromUrl())
  const [credits, setCredits] = useState(false)
  const vehicle = useVehicle(vin)

  const submitVin = useCallback((next: string) => {
    setVin(next)
    // Keep the VIN in the URL so a decoded vehicle is shareable and survives a refresh.
    // Query parameter rather than path segment, so it needs no server-side routing —
    // see docs/DEPLOY.md. `state/codec.ts` writes `?c=` alongside it on the same
    // reasoning; both re-read the live URL, so neither clobbers the other's parameter.
    const url = new URL(window.location.href)
    if (next.trim()) url.searchParams.set('vin', next.trim().toUpperCase())
    else url.searchParams.delete('vin')
    window.history.replaceState(null, '', url)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Scene />
      <Loading />

      {isDebug() && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}

      {/* §12: one edge, never two. Everything interactive lives in the rail. */}
      <Rail>
        <header className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <h1 className="text-lg font-light tracking-[0.3em] text-neutral-100 uppercase">
            {t('app.name')}
          </h1>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button
              type="button"
              aria-label={t('credits.open')}
              onClick={() => setCredits(true)}
              className="size-6 rounded-full border border-white/10 text-[11px] text-neutral-400 transition hover:border-white/30 hover:text-white"
            >
              i
            </button>
          </div>
        </header>

        <VehiclePanel vehicle={vehicle} onSubmit={submitVin} />
        <ConfigPanel />

        {/* BRIEF §1: the reason this is not just a toy. Above the share row because a
            link is worth sharing only once you know what it costs to register. */}
        <Compliance />

        <ShareBar />

        {/* CC BY 4.0 obliges attribution wherever the model is displayed. The full
            notice is one click away in the credits sheet (§4.9); this keeps it from
            ever being zero-click. */}
        <footer className="mt-auto flex items-baseline justify-between gap-3 border-t border-white/10 pt-3 text-[10px] text-neutral-600">
          <button
            type="button"
            onClick={() => setCredits(true)}
            className="text-start underline decoration-white/20 underline-offset-2 transition hover:text-neutral-400"
          >
            Car Concept &copy; 2024 Darmstadt Graphics Group GmbH &middot; CC BY 4.0
          </button>
          {/* All digits and punctuation, no strong direction of its own — under RTL
              the bidi algorithm rendered this as "10 / 9". */}
          <span dir="ltr" className="shrink-0 font-mono tracking-[0.2em] uppercase">
            9 / 10
          </span>
        </footer>
      </Rail>

      <Credits open={credits} onClose={() => setCredits(false)} />
    </div>
  )
}
