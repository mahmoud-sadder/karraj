import { useEffect, useRef, useState } from 'react'

/**
 * The single UI surface, per KARRAJ-LOOKDEV.md §12.
 *
 * §12 is specific and this deliberately follows it rather than improvising:
 *
 *   "Anchor to one edge. Right rail on desktop, bottom sheet on mobile. Never a
 *    floating centre panel, never two opposing rails. Keep >=65% of viewport width as
 *    unbroken canvas."
 *
 * The previous layout broke all three: a VIN card top-left AND a full-width control bar
 * across the bottom, which measured at covering 46.7% of the car. Two anchors, and the
 * car buried under one of them.
 *
 * Rule 3 — "recede at rest" — is implemented here too, but softened. §12 suggests ~30%
 * for non-essential chrome; applied to a whole control panel that is unreadable, so the
 * rail settles to 55% and returns to full on any pointer movement or on hover. The
 * point is for the car to own the frame at rest, not for the controls to disappear.
 */

import { RAIL_WIDTH } from './layout'

const IDLE_MS = 3200

export default function Rail({ children }: { children: React.ReactNode }) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(true), IDLE_MS)
    }
    wake()
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    for (const e of events) window.addEventListener(e, wake, { passive: true })
    return () => {
      window.clearTimeout(timer.current)
      for (const e of events) window.removeEventListener(e, wake)
    }
  }, [])

  return (
    <aside
      // Desktop: a fixed rail on the right, full height, canvas bleeding underneath.
      // Mobile: a bottom sheet, because a 380px rail on a 375px phone is the whole screen.
      className={`pointer-events-none absolute z-10 flex flex-col transition-opacity duration-500 hover:opacity-100 ${
        idle ? 'opacity-55' : 'opacity-100'
      } inset-x-0 bottom-0 max-h-[52vh] md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:max-h-none`}
      style={{ scrollbarWidth: 'thin', ['--rail' as string]: `${RAIL_WIDTH}px` }}
      aria-label="Configurator"
    >
      <div
        className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-white/10 bg-neutral-950/85 p-4 backdrop-blur-xl md:w-[var(--rail)] md:border-l"
      >
        {children}
      </div>
    </aside>
  )
}
