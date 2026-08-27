import { Loader } from '@react-three/drei'

import Scene from './three/Scene'

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Scene />
      <Loader />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 p-6">
        <h1 className="text-2xl font-light tracking-[0.35em] text-neutral-200 uppercase">Karraj</h1>
        <p className="font-mono text-[10px] tracking-[0.3em] text-neutral-600 uppercase">
          scaffold &middot; day 1 of 10
        </p>
      </header>

      {/* CC BY 4.0 obliges attribution wherever the model is displayed. */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-center text-[10px] leading-relaxed text-neutral-700">
        Car Concept &copy; 2024 Darmstadt Graphics Group GmbH, model and textures by Eric Chadwick,
        CC BY 4.0
      </footer>
    </div>
  )
}
