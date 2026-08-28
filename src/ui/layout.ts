/**
 * Layout constants shared by the UI and the camera, plus the projection maths that
 * keeps them agreeing.
 *
 * Its own module on purpose: the camera has to know how much canvas the UI covers in
 * order to frame the car into the part that is actually visible, and exporting that
 * from a component file or from the Scene breaks fast refresh.
 *
 * Keep these in step with what `Rail` actually renders. Each time they drifted apart it
 * cost a visible bug — the desktop rail hid 46.7% of the car, then fixing only the
 * horizontal case hid 100% of it behind the mobile sheet.
 */

export const RAIL_WIDTH = 380
export const MD_BREAKPOINT = 768
/** Must match Rail's `max-h-[52vh]`. */
export const SHEET_FRACTION = 0.52

export interface ViewLayout {
  /** Virtual frame the projection is built for. */
  fullWidth: number
  fullHeight: number
  /** Where the visible canvas sits within it — the UI-covered margin. */
  offsetX: number
  offsetY: number
  /**
   * Aspect the camera must use.
   *
   * NOT the canvas aspect. three builds the base frustum from `camera.aspect` and then
   * scales it by `view.width / view.fullWidth`, so leaving R3F's canvas aspect in place
   * while offsetting stretches the image by exactly fullWidth/width. On a 1728px
   * viewport with a 380px rail that is a 22% horizontal stretch — subtle enough to look
   * like bad modelling rather than a projection bug.
   */
  aspect: number
  /** Half-frustum tangents of the UNCOVERED area, for fitting the car into it. */
  tanHalfH: number
  tanHalfV: number
}

export function viewLayout(width: number, height: number, fovDeg: number): ViewLayout {
  const isDesktop = width >= MD_BREAKPOINT
  const offsetX = isDesktop ? Math.min(RAIL_WIDTH, width * 0.5) : 0
  const offsetY = isDesktop ? 0 : Math.round(height * SHEET_FRACTION)

  const fullWidth = width + offsetX
  const fullHeight = height + offsetY
  const aspect = fullWidth / fullHeight

  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2)
  // Fraction of the virtual frame the user can actually see, per axis.
  const fx = (width - offsetX) / fullWidth
  const fy = (height - offsetY) / fullHeight

  return {
    fullWidth,
    fullHeight,
    offsetX,
    offsetY,
    aspect,
    tanHalfH: tanV * aspect * fx,
    tanHalfV: tanV * fy,
  }
}
