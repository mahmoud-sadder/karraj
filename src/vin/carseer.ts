import type { VehicleIdentity, VinDecoder } from './types'
import { VinDecodeError } from './types'

/**
 * Placeholder for a Carseer-backed decoder.
 *
 * Deliberately unimplemented. It exists to make the seam explicit: everything upstream
 * of `VinDecoder` — the viewer, the model registry, the UI — is already agnostic, so
 * adopting a different decoder is one class and one line of wiring.
 *
 * A MENA decoder would beat vPIC on exactly the vehicles vPIC is weakest at: Chinese
 * makes, Gulf-spec trims, and the import-compliance data that matters in Jordan since
 * the November 2025 regulation. It would also plausibly return richer fields — trim,
 * factory colour, options — which map onto configurator state rather than just model
 * selection.
 */
export class CarseerVinDecoder implements VinDecoder {
  readonly name = 'Carseer'

  async decode(vin: string): Promise<VehicleIdentity> {
    throw new VinDecodeError('Carseer decoder not implemented', vin)
  }
}
