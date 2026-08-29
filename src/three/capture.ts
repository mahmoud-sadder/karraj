import type { RootState } from '@react-three/fiber'
import type { EffectComposer } from 'postprocessing'
import * as THREE from 'three'

import { viewLayout } from '../ui/layout'

/**
 * Screenshot export — BRIEF §8, day 8.
 *
 * ## Why this is not `canvas.toDataURL()`
 *
 * Three things have to be true of an exported frame, and none of them are true of the
 * canvas as it sits:
 *
 * 1. **It has to go through the composer.** Tone mapping lives in the post-processing
 *    chain and nowhere else (see `Post.tsx`), so a plain `gl.render` produces a
 *    washed-out linear image that looks nothing like the screen.
 * 2. **It has to be bigger than the canvas.** BRIEF §6: "Remember to resize the
 *    *composer* too, or you get a crop." Resizing the renderer alone leaves every
 *    post-processing render target at the old size, and the effects only cover the
 *    top-left corner of the new frame.
 * 3. **It must not contain the hole the UI was sitting in.** The scene is framed with
 *    the car pushed clear of the rail; export the whole canvas and you get a car
 *    hugging one edge with a third of the image empty, which reads as a mistake.
 *
 * (3) is solved with the same `setViewOffset` mechanism the on-screen framing uses.
 * The canvas shows the virtual rectangle `(offsetX, offsetY, width, height)`, so canvas
 * pixel `(px, py)` is virtual pixel `(offsetX + px, offsetY + py)` — and the uncovered
 * region is therefore the virtual rectangle `(offsetX + freeX, offsetY + freeY,
 * freeWidth, freeHeight)`. Rendering exactly that sub-window into a buffer of the same
 * aspect gives back precisely the pixels the user can see, at whatever scale is asked
 * for, with no reframing and no stretch.
 *
 * `camera.aspect` is deliberately left alone. Overriding it alongside a view offset is
 * what stretched the car 22% during a quality-tier change on day 6; the fix was to stop
 * having two things own the same value, and that fix holds here too.
 */

/**
 * The pieces of the R3F root that live inside the Canvas and are needed outside it.
 *
 * `get` rather than a snapshot, so a capture triggered after a resize or a quality-tier
 * change reads the sizes that are current rather than the ones that were current when
 * the button rendered.
 */
interface CaptureSource {
  get: () => RootState
  tier: number
}

let source: CaptureSource | null = null
let composer: EffectComposer | null = null

/** Called by `CaptureBridge` inside the Canvas. Returns an unregister. */
export function registerCaptureSource(next: CaptureSource): () => void {
  source = next
  return () => {
    if (source === next) source = null
  }
}

/** Callback ref on the `<EffectComposer>`. React passes null on unmount. */
export function setCaptureComposer(next: EffectComposer | null): void {
  composer = next
}

export const captureReady = (): boolean => source !== null

/**
 * Upper bounds on the exported image.
 *
 * The composer allocates several full-size half-float targets and, above tier 1, a
 * multisampled one — so the memory cost is a multiple of the output, not equal to it.
 * 4K is where that stops being free and starts being a tab crash on a phone.
 */
const MAX_EDGE = 4096
const MAX_PIXELS = 3840 * 2160

export interface CaptureResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Renders one frame at `scale`× the visible area and returns it as a PNG.
 *
 * Everything is restored before this returns, including on failure. The renderer is
 * left exactly as it was found: same size, same pixel ratio, same view offset.
 */
export async function captureFrame({
  rtl,
  scale = 2,
}: {
  rtl: boolean
  scale?: number
}): Promise<CaptureResult> {
  if (!source) throw new Error('The scene is still loading.')

  const state = source.get()
  const { gl, scene: threeScene, size, invalidate } = state
  const camera = state.camera as THREE.PerspectiveCamera

  const layout = viewLayout(size.width, size.height, camera.fov, rtl)
  const frameWidth = Math.max(1, Math.round(layout.freeWidth))
  const frameHeight = Math.max(1, Math.round(layout.freeHeight))

  // A weak device just proved it cannot hold 60fps at 1× — do not then ask it for a
  // 4× oversampled frame with the bloom chain running.
  const requested = source.tier >= 1 ? scale : 1
  const edgeCap = Math.min(MAX_EDGE, gl.capabilities.maxTextureSize)
  const effective = Math.max(
    1,
    Math.min(
      requested,
      edgeCap / Math.max(frameWidth, frameHeight),
      Math.sqrt(MAX_PIXELS / (frameWidth * frameHeight)),
    ),
  )

  const width = Math.round(frameWidth * effective)
  const height = Math.round(frameHeight * effective)

  const previousSize = gl.getSize(new THREE.Vector2())
  const previousPixelRatio = gl.getPixelRatio()
  const previousView = camera.view ? { ...camera.view } : null
  const previousToneMapping = gl.toneMapping

  let pending: Promise<Blob | null>

  try {
    // Pixel ratio first: setSize multiplies by it, and the point here is an exact
    // pixel count rather than a CSS size.
    gl.setPixelRatio(1)
    // `updateStyle: false` — the canvas keeps its layout size, so no ResizeObserver
    // fires and R3F never learns this happened.
    gl.setSize(width, height, false)
    composer?.setSize(width, height)

    camera.setViewOffset(
      size.width,
      size.height,
      layout.offsetX + layout.freeX,
      layout.offsetY + layout.freeY,
      frameWidth,
      frameHeight,
    )
    camera.updateProjectionMatrix()

    if (composer) {
      composer.render()
    } else {
      // Should not happen, but a silently washed-out export would be worse than an
      // approximate one: without the composer, tone mapping has to come from somewhere.
      gl.toneMapping = THREE.NeutralToneMapping
      gl.render(threeScene, camera)
    }

    // `toBlob` copies the bitmap synchronously and only encodes in parallel, so the
    // call has to happen here — before the restore below resizes the drawing buffer —
    // while the await happens after. Awaiting inside the try would leave the canvas
    // resized across a paint, which is a visible flash.
    pending = new Promise<Blob | null>((resolve) =>
      gl.domElement.toBlob(resolve, 'image/png'),
    )
  } finally {
    gl.setPixelRatio(previousPixelRatio)
    gl.setSize(previousSize.width, previousSize.height, false)
    composer?.setSize(previousSize.width, previousSize.height)
    gl.toneMapping = previousToneMapping

    if (previousView?.enabled) {
      camera.setViewOffset(
        previousView.fullWidth,
        previousView.fullHeight,
        previousView.offsetX,
        previousView.offsetY,
        previousView.width,
        previousView.height,
      )
    } else {
      camera.clearViewOffset()
    }
    camera.updateProjectionMatrix()

    // The drawing buffer was just cleared by the resize. Redraw before the next paint.
    invalidate()
  }

  const blob = await pending
  if (!blob) throw new Error('The browser would not encode the image.')
  return { blob, width, height }
}

/** Hands a blob to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking immediately races the download in Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
