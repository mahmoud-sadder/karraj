import { Loader } from '@react-three/drei'
import { lazy, Suspense, useCallback, useState } from 'react'

import { isDebug } from './state/art'
import Scene from './three/Scene'
import Rail from './ui/Rail'
import ConfigPanel from './ui/ConfigPanel'
import VehiclePanel from './ui/VehiclePanel'
import { useVehicle, vinFromUrl } from './vin/useVehicle'

/**
 * Lazy so leva never lands in the production bundle — Vite splits it into its own
 * chunk that is only fetched when `?debug=1` is present.
 */
const DebugPanel = lazy(() => import('./debug/DebugPanel'))

export default function App() {
  const [vin, setVin] = useState<string | null>(() => vinFromUrl())
  const vehicle = useVehicle(vin)

  const submitVin = useCallback((next: string) => {
    setVin(next)
    // Keep the VIN in the URL so a decoded vehicle is shareable and survives a refresh.
    // Query parameter rather than path segment, so it needs no server-side routing —
    // see docs/DEPLOY.md. Same reasoning the day-8 config codec will follow.
    const url = new URL(window.location.href)
    if (next.trim()) url.searchParams.set('vin', next.trim().toUpperCase())
    else url.searchParams.delete('vin')
    window.history.replaceState(null, '', url)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Scene />
      <Loader />

      {isDebug() && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}

      {/* §12: one edge, never two. Everything interactive lives in the rail. */}
      <Rail>
        <header className="flex items-baseline justify-between border-b border-white/10 pb-3">
          <h1 className="text-lg font-light tracking-[0.3em] text-neutral-100 uppercase">Karraj</h1>
          <span className="font-mono text-[9px] tracking-[0.2em] text-neutral-600 uppercase">
            day 6 / 10
          </span>
        </header>

        <VehiclePanel vehicle={vehicle} onSubmit={submitVin} />
        <ConfigPanel />

        {/* CC BY 4.0 obliges attribution wherever the model is displayed. */}
        <footer className="mt-auto border-t border-white/10 pt-3 text-[10px] leading-relaxed text-neutral-600">
          Car Concept &copy; 2024 Darmstadt Graphics Group GmbH, model and textures by Eric
          Chadwick, CC BY 4.0
        </footer>
      </Rail>
    </div>
  )
}
