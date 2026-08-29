import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useSceneReady } from '../state/loading'

/**
 * The loading cover — BRIEF §8, day 8.
 *
 * Replaces drei's `<Loader />`, which is a generic overlay with a percentage bar and
 * looks like a debug tool.
 *
 * ## Why there is no percentage
 *
 * There is exactly one asset: `car.glb`. `useProgress` counts *items*, not bytes, so
 * with a single item its progress is 0 for the whole download and then 100 — a bar
 * that sits still and jumps is worse than no bar, because it reads as a hang. Real
 * byte progress would mean bypassing `useGLTF` (which does not forward `onProgress`)
 * and wiring `GLTFLoader` by hand, which needs `three-stdlib` as a direct dependency
 * and a meshopt decoder set up manually. Not worth a dependency for a progress bar,
 * so this is honestly indeterminate instead of dishonestly precise.
 *
 * ## Timing
 *
 * The cover is the page's first paint, so it never "appears" — there is no flash to
 * avoid. It leaves on a 600 ms fade once the scene has actually mounted, which also
 * covers the few frames the contact shadows and the environment cube take to bake.
 */

const FADE_MS = 600

export default function Loading() {
  const ready = useSceneReady((s) => s.ready)
  const { errors } = useProgress()
  const [mounted, setMounted] = useState(true)
  const failed = errors.length > 0

  useEffect(() => {
    if (!ready || failed) return
    const timer = window.setTimeout(() => setMounted(false), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [ready, failed])

  if (!mounted) return null

  const hiding = ready && !failed

  return (
    <div
      role="status"
      aria-live="polite"
      // Above the rail (z-10), below nothing. `pointer-events-none` from the moment it
      // starts fading, so the car is draggable through the last frames of the fade.
      className={`bg-garage-void absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 transition-opacity duration-[600ms] ${
        hiding ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* The negative inline-end margin cancels the trailing letter-space that tracking
          adds after the last character. Without it the wordmark sits half a letter-space
          left of the text below it, which is small and, once seen, all you can see. */}
      <h1 className="-me-[0.45em] text-xl font-light tracking-[0.45em] text-neutral-200 uppercase">
        Karraj
      </h1>

      {failed ? (
        <div className="flex flex-col items-center gap-3 px-8 text-center">
          <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
            The car model could not be loaded. It may be a network problem.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-white/90 px-3 py-1.5 font-mono text-[10px] tracking-widest text-neutral-900 uppercase transition hover:bg-white"
          >
            retry
          </button>
        </div>
      ) : (
        <>
          {/* Indeterminate: a highlight sweeping a hairline track. */}
          <div className="h-px w-40 overflow-hidden bg-white/10">
            <div className="karraj-sweep h-full w-1/5 bg-white/70" />
          </div>
          <p className="font-mono text-[9px] tracking-[0.25em] text-neutral-600 uppercase">
            preparing the car
          </p>
        </>
      )}
    </div>
  )
}
