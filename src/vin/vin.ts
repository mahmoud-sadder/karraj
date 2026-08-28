/**
 * VIN primitives — format, transliteration and check digit.
 *
 * Worth doing locally rather than delegating to the decode API: it rejects typos
 * instantly and offline, and a wrong VIN is the single most common input error in this
 * domain. A vehicle-history product lives or dies on getting this right.
 */

/** I, O and Q are excluded from the VIN alphabet precisely because they look like 1 and 0. */
const VIN_ALPHABET = /^[A-HJ-NPR-Z0-9]{17}$/

/** ISO 3779 transliteration. Digits map to themselves. */
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}

/** Positional weights. Position 9 is the check digit itself, hence weight 0. */
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

export const normalizeVin = (raw: string): string => raw.trim().toUpperCase().replace(/[\s-]/g, '')

export const hasValidVinFormat = (vin: string): boolean => VIN_ALPHABET.test(vin)

/**
 * The check digit that position 9 *should* hold, as '0'–'9' or 'X'.
 * Returns null when the VIN is not well-formed enough to compute one.
 */
export function expectedCheckDigit(vin: string): string | null {
  if (!hasValidVinFormat(vin)) return null
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const char = vin[i]
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char]
    if (value === undefined) return null
    sum += value * WEIGHTS[i]
  }
  const remainder = sum % 11
  return remainder === 10 ? 'X' : String(remainder)
}

export function hasValidCheckDigit(vin: string): boolean {
  const expected = expectedCheckDigit(vin)
  return expected !== null && expected === vin[8]
}

export type VinProblem = 'length' | 'charset' | 'checkdigit' | null

/**
 * Note that a failed check digit is reported but is NOT treated as fatal by callers.
 * Vehicles built for markets outside North America are not always required to carry a
 * valid one, so refusing to decode on that basis alone would reject real cars — which
 * matters in a market importing from everywhere.
 */
export function inspectVin(raw: string): { vin: string; problem: VinProblem } {
  const vin = normalizeVin(raw)
  if (vin.length !== 17) return { vin, problem: 'length' }
  if (!hasValidVinFormat(vin)) return { vin, problem: 'charset' }
  if (!hasValidCheckDigit(vin)) return { vin, problem: 'checkdigit' }
  return { vin, problem: null }
}
