import type { VehicleIdentity } from './types'

/**
 * Body class → 3D model.
 *
 * This is where the VIN path meets the asset pipeline, and it is deliberately keyed on
 * `bodyClass` rather than make/model. Two reasons.
 *
 * First, it scales: vPIC reports a few dozen body classes against millions of
 * make/model/year combinations, so a handful of well-made generic shapes covers most
 * of what a real inventory throws at you.
 *
 * Second, nobody notices. A viewer looking at their sedan cares that it is a four-door
 * saloon sitting at the right stance with the right paint; they are not checking the
 * shut lines against a press photo. Matching the silhouette buys almost all of the
 * perceived accuracy.
 *
 * Every model listed here must have been through `tools/prepare-car.mjs` and carry the
 * same material slugs — that contract is what lets the runtime stay ignorant of which
 * car it is rendering.
 */

export interface CarModelEntry {
  id: string
  url: string
  label: string
  /** false = no asset yet; the resolver falls back and says so. */
  available: boolean
}

const CONCEPT: CarModelEntry = {
  id: 'concept',
  url: '/models/car.glb',
  label: 'Concept coupé',
  available: true,
}

/**
 * Only one asset exists today, so most rows point at the fallback. That is the honest
 * state of it: the *plumbing* is real and the registry is where new models slot in, one
 * line each, once they have been through the pipeline and passed the separation check.
 */
export const MODEL_REGISTRY: Record<string, CarModelEntry> = {
  'Sedan/Saloon': { id: 'sedan', url: '/models/car.glb', label: 'Sedan', available: false },
  Coupe: CONCEPT,
  'Convertible/Cabriolet': { id: 'convertible', url: '/models/car.glb', label: 'Convertible', available: false },
  Hatchback: { id: 'hatchback', url: '/models/car.glb', label: 'Hatchback', available: false },
  'Wagon/Sport Utility Wagon': { id: 'wagon', url: '/models/car.glb', label: 'Wagon', available: false },
  'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)': {
    id: 'suv', url: '/models/car.glb', label: 'SUV', available: false,
  },
  Pickup: { id: 'pickup', url: '/models/car.glb', label: 'Pickup', available: false },
  Van: { id: 'van', url: '/models/car.glb', label: 'Van', available: false },
}

export interface ModelResolution {
  entry: CarModelEntry
  /** True when we had no asset for this body class and fell back. */
  substituted: boolean
  reason: string
}

export function resolveModel(identity: VehicleIdentity | null): ModelResolution {
  if (!identity?.bodyClass) {
    return {
      entry: CONCEPT,
      substituted: true,
      reason: identity ? 'decoder returned no body class' : 'no VIN supplied',
    }
  }

  const match = MODEL_REGISTRY[identity.bodyClass]
  if (match?.available) return { entry: match, substituted: false, reason: 'exact body class' }

  return {
    entry: CONCEPT,
    substituted: true,
    reason: match
      ? `no ${match.label.toLowerCase()} asset yet`
      : `unmapped body class "${identity.bodyClass}"`,
  }
}
