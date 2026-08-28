import { Loader } from '@react-three/drei'
import { lazy, Suspense } from 'react'

import { isDebug } from './state/art'
import Scene from './three/Scene'
import PaintSwatches from './ui/PaintSwatches'

/**
 * Lazy so leva never lands in the production bundle — Vite splits it into its own
 * chunk that is only fetched when `?debug=1` is present. BRIEF §7 wants the panel
 * dropped from production at the end of day 7; loading it this way means it was never
 * there to begin with.
 */
const DebugPanel = lazy(() => import('./debug/DebugPanel'))

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Scene />
      <Loader />

      {isDebug() && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 p-6">
        <h1 className="text-2xl font-light tracking-[0.35em] text-neutral-200 uppercase">Karraj</h1>
        <p className="font-mono text-[10px] tracking-[0.3em] text-neutral-600 uppercase">
          scaffold &middot; day 3 of 10
        </p>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-4">
        <PaintSwatches />
      </div>

      {/* CC BY 4.0 obliges attribution wherever the model is displayed. */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-center text-[10px] leading-relaxed text-neutral-700">
        Car Concept &copy; 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick,
        CC BY 4.0
      </footer>
    </div>
  )
}
