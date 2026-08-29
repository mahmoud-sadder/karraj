import { create } from 'zustand'

/**
 * Whether the scene has actually mounted.
 *
 * A store rather than context because the signal has to cross the `<Canvas>` boundary:
 * R3F runs its own reconciler, so React context does not reach from inside the canvas
 * to the DOM overlay outside it.
 *
 * `drei`'s `useProgress` is not enough on its own. It reports the loading manager
 * finishing, which happens a little before the Suspense boundary resolves and the first
 * frame is drawn — hiding the cover on it shows a black canvas for a beat. The sentinel
 * below is set by a component that only exists once everything suspended has resolved,
 * which is the exact moment there is something to look at.
 */
interface SceneReadyStore {
  ready: boolean
  markReady: () => void
}

export const useSceneReady = create<SceneReadyStore>()((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
}))
