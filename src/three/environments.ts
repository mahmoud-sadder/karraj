import * as THREE from 'three'

/**
 * The three scene presets from KARRAJ-LOOKDEV.md §2.
 *
 * Same car, same camera rig, swapped lighting and set. §2 is emphatic that Studio is
 * not optional: a very dark scene makes every paint colour look expensive *and* makes
 * every paint colour look similar. If someone is choosing paint, they need somewhere to
 * actually see it. That is a functional requirement, not a nicety.
 *
 * Every value here is a starting point for day 7, not a final answer — they are all
 * exposed in the leva panel.
 */

export const ENVIRONMENTS = ['garage', 'studio', 'night'] as const
export type EnvironmentId = (typeof ENVIRONMENTS)[number]

export interface Lightformer {
  form: 'rect' | 'circle'
  intensity: number
  color: string
  scale: [number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
}

export interface EnvironmentPreset {
  label: string
  description: string
  /** Clear colour and the colour the fog resolves toward. */
  background: string
  fogDensity: number
  exposure: number
  environmentIntensity: number
  floorColor: string
  floorRoughness: number
  contactOpacity: number
  contactPoolOpacity: number
  /** Colour of the giant inverted sphere inside <Environment>. §3's negative fill. */
  surround: string
  lightformers: Lightformer[]
}

/**
 * §3's rig, and the reason it is shaped this way: you are not lighting the car, you are
 * choosing what the car reflects. Long thin bright rectangles produce a crisp-edged
 * streak down the flank, and that edge is what reads as gloss. A dome or a bare HDRI
 * gives correct illumination and no specular structure at all.
 *
 * Intensity ratios from real automotive practice: key 1.0 → flanks 0.6-0.8 →
 * rim/kicker 1.2-2.0 (small area, high intensity) → bounce fill 0.1-0.2.
 */
export const ENVIRONMENT_PRESETS: Record<EnvironmentId, EnvironmentPreset> = {
  garage: {
    label: 'Garage',
    description: 'Dark, tight room. Where screenshots get taken.',
    background: '#0a0b0d',
    fogDensity: 0.055,
    exposure: 1.15,
    environmentIntensity: 1.0,
    floorColor: '#31353b',
    floorRoughness: 0.45,
    contactOpacity: 0.9,
    contactPoolOpacity: 0.4,
    surround: '#0a0b0d',
    lightformers: [
      // KEY — nose-to-tail strip, high above. Does the work on the paint.
      { form: 'rect', intensity: 6, color: '#f2f6ff', scale: [10, 1.1], position: [0, 6, 0], rotation: [Math.PI / 2, 0, 0] },
      // FLANK STRIPS — these make the side streaks.
      { form: 'rect', intensity: 3, color: '#e8f0ff', scale: [9, 0.8], position: [-5, 3, 0], rotation: [0, Math.PI / 2, 0] },
      { form: 'rect', intensity: 2, color: '#e8f0ff', scale: [9, 0.8], position: [5, 3, 0], rotation: [0, -Math.PI / 2, 0] },
      // REAR 3/4 KICKER — rims the shoulder line, separates car from background.
      { form: 'rect', intensity: 8, color: '#ffffff', scale: [2, 2], position: [3.5, 2.2, -5] },
      // WARM FILL — the cinematography move. Warm shadows against a cool key.
      { form: 'rect', intensity: 1, color: '#ffd9b0', scale: [7, 2.6], position: [-4.5, 0.6, 3] },
    ],
  },

  studio: {
    label: 'Studio',
    description: 'Neutral and even. For judging paint colour honestly.',
    // Background and floor sit close in value on purpose. §8: a hard floor/wall seam
    // behind the car "cuts the composition in half and reads as a cheap set". With the
    // fog low enough to keep the field readable, closing the tonal gap is what actually
    // dissolves the horizon.
    background: '#3f434a',
    fogDensity: 0.03,
    exposure: 1.05,
    environmentIntensity: 1.25,
    floorColor: '#484c53',
    floorRoughness: 0.6,
    // Softer grounding: a hard black contact patch fights the low-contrast look.
    contactOpacity: 0.55,
    contactPoolOpacity: 0.28,
    surround: '#454951',
    lightformers: [
      // Broad and balanced rather than dramatic — GT Auto rather than Forzavista.
      { form: 'rect', intensity: 3.2, color: '#ffffff', scale: [14, 5], position: [0, 7, 0], rotation: [Math.PI / 2, 0, 0] },
      { form: 'rect', intensity: 2.2, color: '#ffffff', scale: [10, 5], position: [-6, 2.5, 1], rotation: [0, Math.PI / 2, 0] },
      { form: 'rect', intensity: 2.2, color: '#ffffff', scale: [10, 5], position: [6, 2.5, 1], rotation: [0, -Math.PI / 2, 0] },
      { form: 'rect', intensity: 1.6, color: '#ffffff', scale: [10, 4], position: [0, 2, -7] },
      { form: 'rect', intensity: 1.2, color: '#ffffff', scale: [10, 4], position: [0, 1.2, 7] },
    ],
  },

  night: {
    label: 'Night',
    description: 'Car meet. Near-black with a cyan and magenta edge.',
    background: '#05060a',
    fogDensity: 0.085,
    exposure: 1.25,
    environmentIntensity: 0.8,
    floorColor: '#23262e',
    floorRoughness: 0.3,
    contactOpacity: 0.95,
    contactPoolOpacity: 0.45,
    surround: '#05060a',
    lightformers: [
      // §11's rule: accent colour may light the room, but must never be the primary
      // source landing on the paint — otherwise the paint colour becomes a lie and the
      // configurator stops functioning. The key stays white and dominant.
      { form: 'rect', intensity: 4.5, color: '#eef4ff', scale: [9, 0.8], position: [0, 6, 0], rotation: [Math.PI / 2, 0, 0] },
      { form: 'rect', intensity: 1.4, color: '#dfe9ff', scale: [8, 0.5], position: [-5, 2.6, 0], rotation: [0, Math.PI / 2, 0] },
      // Edge neon BEHIND the car — §11's safest accent: reads in the floor reflection
      // and puts a coloured rim on the rear edge without touching the paint's hue.
      { form: 'rect', intensity: 5, color: '#19c6ff', scale: [7, 0.14], position: [0, 0.35, -6] },
      { form: 'rect', intensity: 3.5, color: '#ff2fd0', scale: [0.14, 4], position: [6.5, 1.6, -3], rotation: [0, -Math.PI / 2, 0] },
    ],
  },
}

/** Euler helper so presets can stay plain data. */
export const rotationOf = (l: Lightformer): [number, number, number] =>
  l.rotation ?? [0, 0, 0]

export const surroundColor = (id: EnvironmentId): THREE.Color =>
  new THREE.Color().setStyle(ENVIRONMENT_PRESETS[id].surround, THREE.SRGBColorSpace)
