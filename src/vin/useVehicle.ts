import { useEffect, useMemo, useState } from 'react'

import { NhtsaVinDecoder } from './nhtsa'
import { resolveModel, type ModelResolution } from './registry'
import type { VehicleIdentity, VinDecoder } from './types'
import { inspectVin, type VinProblem } from './vin'

/** Swap this one line to change decoder. Nothing downstream knows the difference. */
const decoder: VinDecoder = new NhtsaVinDecoder()

export interface VehicleState {
  status: 'idle' | 'invalid' | 'loading' | 'ready' | 'error'
  vin: string | null
  problem: VinProblem
  identity: VehicleIdentity | null
  model: ModelResolution
  error: string | null
  decoderName: string
}

/** `?vin=WBANE535X7CW65098` */
export const vinFromUrl = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('vin')

interface DecodeResult {
  vin: string
  identity: VehicleIdentity | null
  error: string | null
}

export function useVehicle(rawVin: string | null): VehicleState {
  const inspected = useMemo(() => (rawVin ? inspectVin(rawVin) : null), [rawVin])

  // Length and charset are fatal — no point spending a request on them. A bad check
  // digit is not: plenty of vehicles built outside North America carry one that does
  // not validate, and refusing to decode on that basis would reject real cars in an
  // import market. It is surfaced as a warning instead.
  const fatal = inspected?.problem === 'length' || inspected?.problem === 'charset'
  const vin = !inspected || fatal ? null : inspected.vin

  const [result, setResult] = useState<DecodeResult | null>(null)

  useEffect(() => {
    if (!vin) return
    const controller = new AbortController()

    decoder
      .decode(vin, controller.signal)
      .then((identity) => {
        if (!controller.signal.aborted) setResult({ vin, identity, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResult({ vin, identity: null, error: err instanceof Error ? err.message : String(err) })
      })

    return () => controller.abort()
  }, [vin])

  // Everything except the in-flight request is derivable, so it is derived rather than
  // mirrored into state.
  const settled = result?.vin === vin ? result : null
  const status: VehicleState['status'] = !inspected
    ? 'idle'
    : fatal
      ? 'invalid'
      : !settled
        ? 'loading'
        : settled.error
          ? 'error'
          : 'ready'

  const identity = settled?.identity ?? null

  return {
    status,
    vin: inspected?.vin ?? null,
    problem: inspected?.problem ?? null,
    identity,
    model: resolveModel(identity),
    error: settled?.error ?? null,
    decoderName: decoder.name,
  }
}
