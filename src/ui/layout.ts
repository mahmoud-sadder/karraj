/**
 * Layout constants shared by the UI and the camera, plus the projection maths that
 * keeps them agreeing.
 *
 * Its own module on purpose: the camera has to know how much canvas the UI covers in
 * order to frame the car into the part that is actually visible, and exporting that
 * from a component file or from the Scene breaks fast refresh.
 */

export const RAIL_WIDTH = 380
export const MD_BREAKPOINT = 768
/** Must match Rail's `max-h-[52vh]`. */
export const SHEET_FRACTION = 0.52

export interface ViewLayout {
  /** Pure lateral/vertical shift of the frustum, in pixels. Never scales it. */
  offsetX: number
  offsetY: number
  /** Half-frustum tangents of the UNCOVERED area, for fitting the car into it. */
  tanHalfH: number
  tanHalfV: number
  /**
   * The canvas rectangle the UI is NOT covering, in CSS pixels, origin top-left.
   *
   * The camera offset above says how far to shift; this says what the shift was making
   * room for. Screenshot export needs the second: an exported image has no rail in it,
   * so it should contain the free rectangle rather than the whole canvas with a blank
   * strip where the UI used to be.
   */
  freeX: number
  freeY: number
  freeWidth: number
  freeHeight: number
}

/**
 * Where to put the car so the UI is not covering it.
 *
 * `setViewOffset` is used as a pure SHIFT here — `fullWidth`/`fullHeight` equal the
 * canvas size, so three's `width *= view.width / view.fullWidth` is a multiply by one
 * and the frustum keeps its shape. Only `left` and `top` move.
 *
 * The earlier version instead widened the virtual frame and compensated by overriding
 * `camera.aspect`. That worked until anything else touched the aspect: R3F rewrites it
 * whenever the drawing buffer resizes, which includes a device-pixel-ratio change from
 * the adaptive quality tier. A tier drop during a drag therefore restored the canvas
 * aspect while leaving the view offset in place, and the car stretched ~22% horizontally
 * until the page was reloaded. Shifting without scaling removes the conflict entirely —
 * nothing here depends on `camera.aspect` holding a value R3F does not expect.
 */
export function viewLayout(
  width: number,
  height: number,
  fovDeg: number,
  rtl = false,
): ViewLayout {
  // A zero-size viewport is a normal transient state, not an error: React renders
  // before layout, and an iframe or a restored background tab can report 0x0 for
  // several frames. Unguarded, `(width - rail) / width` is 0/0, every tangent below is
  // NaN, and the camera distance computed from them is NaN too — at which point
  // OrbitControls damps toward a NaN target forever and the canvas never draws again.
  // Clamping here is cheaper than making four callers defensive.
  const w = Math.max(1, width)
  const h = Math.max(1, height)

  const isDesktop = w >= MD_BREAKPOINT
  const rail = isDesktop ? Math.min(RAIL_WIDTH, w * 0.5) : 0
  // Leave at least one pixel of canvas, so the uncovered area can never be empty.
  const sheet = isDesktop ? 0 : Math.min(Math.round(h * SHEET_FRACTION), h - 1)

  // Shifting the frustum by half the covered width centres the car in what remains.
  // Positive offsetX moves the frustum right, i.e. the car left — correct when the rail
  // is on the trailing edge. RTL puts the rail on the leading edge, so the sign flips.
  const offsetX = (rtl ? -rail : rail) / 2
  // The sheet is always at the bottom, so this never flips.
  const offsetY = sheet / 2

  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2)
  return {
    offsetX,
    offsetY,
    // The rail sits on the trailing edge, so it eats the right of the canvas in LTR and
    // the left in RTL. The sheet is always along the bottom.
    freeX: rtl ? rail : 0,
    freeY: 0,
    freeWidth: w - rail,
    freeHeight: h - sheet,
    // The full canvas subtends the camera's normal frustum; the uncovered part subtends
    // a proportional share of it, and that is what the car has to fit inside.
    tanHalfH: tanV * (w / h) * ((w - rail) / w),
    tanHalfV: tanV * ((h - sheet) / h),
  }
}
