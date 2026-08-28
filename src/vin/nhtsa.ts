import type { VehicleIdentity, VinDecoder } from './types'
import { VinDecodeError } from './types'

/**
 * NHTSA vPIC — the US DOT's vehicle product information catalogue.
 *
 * Free, no API key, and it answers with `access-control-allow-origin: *`, so the
 * browser calls it directly. No backend, no proxy, no secret to rotate — which is what
 * keeps this project deployable as pure static files.
 *
 * Known limitation: it is a US agency, so coverage of Chinese-market vehicles is thin.
 * A BYD VIN can come back with a manufacturer and nothing else. `sparse` flags that so
 * the UI can say so honestly rather than rendering blanks.
 */

const ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'

/** vPIC returns "" or "Not Applicable" rather than omitting fields. */
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || /^not applicable$/i.test(s) || s === '0') return null
  return s
}

const num = (v: unknown): number | null => {
  const s = clean(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

interface VpicRow {
  ErrorCode?: string
  ErrorText?: string
  Make?: string
  Model?: string
  ModelYear?: string
  Series?: string
  BodyClass?: string
  Doors?: string
  FuelTypePrimary?: string
  PlantCountry?: string
}

export class NhtsaVinDecoder implements VinDecoder {
  readonly name = 'NHTSA vPIC'

  async decode(vin: string, signal?: AbortSignal): Promise<VehicleIdentity> {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(vin)}?format=json`, { signal })
    if (!res.ok) throw new VinDecodeError(`vPIC returned HTTP ${res.status}`, vin)

    const row = ((await res.json()) as { Results?: VpicRow[] }).Results?.[0]
    if (!row) throw new VinDecodeError('vPIC returned no rows', vin)

    const make = clean(row.Make)
    const model = clean(row.Model)
    const bodyClass = clean(row.BodyClass)

    // ErrorCode "0" means a clean decode. Anything else is advisory — vPIC still
    // returns whatever it managed to resolve, and partial data is useful here.
    if (!make && !model && !bodyClass) {
      throw new VinDecodeError(clean(row.ErrorText) ?? 'VIN could not be decoded', vin)
    }

    return {
      vin,
      make,
      model,
      year: num(row.ModelYear),
      series: clean(row.Series),
      bodyClass,
      doors: num(row.Doors),
      fuelType: clean(row.FuelTypePrimary),
      plantCountry: clean(row.PlantCountry),
      sparse: !model || !bodyClass,
    }
  }
}
