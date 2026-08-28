import { useEffect, useState } from 'react'

/**
 * The document's writing direction, as reactive state.
 *
 * Reading `document.dir` inside an effect is not enough: the camera's projection offset
 * depends on which edge the rail is on, and an effect keyed on viewport size will not
 * re-run when only the direction changes. That left the car correctly framed in LTR and
 * sitting behind the rail in RTL.
 *
 * An observer rather than a store, because `dir` is set on <html> and day 9's language
 * switch is not the only thing that might set it — a browser translation feature or an
 * embedding page can too, and the scene should follow either way.
 */
export type Direction = 'ltr' | 'rtl'

const read = (): Direction =>
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'

export function useDirection(): Direction {
  const [dir, setDir] = useState<Direction>(read)

  useEffect(() => {
    const observer = new MutationObserver(() => setDir(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] })
    return () => observer.disconnect()
  }, [])

  return dir
}
