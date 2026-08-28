import { Loader } from '@react-three/drei'
import { lazy, Suspense, useCallback, useState } from 'react'

import { isDebug } from './state/art'
import Scene from './three/Scene'
import VehicleControls from './ui/VehicleControls'
import VehiclePanel from './ui/VehiclePanel'
import { useVehicle, vinFromUrl } from './vin/useVehicle'

/**
 * Lazy so leva never lands in the production bundle — Vite splits it into its own
 * chunk that is only fetched when `?debug=1` is present. BRIEF §7 wants the panel
 * dropped from production at the end of day 7; loading it this way means it was never
 * there to begin with.
 */
const DebugPanel = lazy(() => import('./debug/DebugPanel'))

export default function App() {
  const [vin, setVin] = useState<string | null>(() => vinFromUrl())
  const vehicle = useVehicle(vin)

  const submitVin = useCallback((next: string) => {
    setVin(next)
    // Keep the VIN in the URL so a decoded vehicle is shareable and survives a refresh.
    // A query parameter rather than a path segment, so it needs no server-side routing
    // — see docs/DEPLOY.md. Same reasoning the day-8 config codec will follow.
    const url = new URL(window.location.href)
    if (next.trim()) url.searchParams.set('vin', next.trim().toUpperCase())
    else url.searchParams.delete('vin')
    window.history.replaceState(null, '', url)
  }, [])

  return (
    <div className="relative h-full w-full">
      <Scene />
      <Loader />

      {isDebug() && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}

      <div className="pointer-events-none absolute top-4 left-4">
        <VehiclePanel vehicle={vehicle} onSubmit={submitVin} />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 p-6">
        <h1 className="text-2xl font-light tracking-[0.35em] text-neutral-200 uppercase">Karraj</h1>
        <p className="font-mono text-[10px] tracking-[0.3em] text-neutral-600 uppercase">
          scaffold &middot; day 4 of 10
        </p>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-4">
        <VehicleControls />
      </div>

      {/* CC BY 4.0 obliges attribution wherever the model is displayed. */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-center text-[10px] leading-relaxed text-neutral-700">
        Car Concept &copy; 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick,
        CC BY 4.0
      </footer>
    </div>
  )
}
