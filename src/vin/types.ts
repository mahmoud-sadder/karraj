/**
 * The VIN decoding contract.
 *
 * An interface rather than a direct call to one vendor, because the decoder is the
 * part most likely to be swapped. NHTSA's vPIC is free, keyless and CORS-open, which
 * makes it the right default; a MENA-focused decoder with better coverage of Chinese
 * and Gulf-spec vehicles would slot in behind the same shape without the viewer
 * knowing anything changed.
 */

export interface VehicleIdentity {
  vin: string
  make: string | null
  model: string | null
  year: number | null
  series: string | null
  /** The field that actually selects a 3D model. e.g. "Sedan/Saloon", "Pickup". */
  bodyClass: string | null
  doors: number | null
  fuelType: string | null
  plantCountry: string | null
  /** True when the decoder returned nothing useful beyond the manufacturer. */
  sparse: boolean
}

export interface VinDecoder {
  readonly name: string
  decode(vin: string, signal?: AbortSignal): Promise<VehicleIdentity>
}

export class VinDecodeError extends Error {
  readonly vin: string

  constructor(message: string, vin: string) {
    super(message)
    this.name = 'VinDecodeError'
    this.vin = vin
  }
}
