import type { RegistryFailureReason } from '../models/registry-error'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createTextDecoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'

/** Outcome of a failed `npm view` invocation. */
export type NpmLookupFailure = AbsentLookupFailure | UnavailableLookupFailure

/** The registry answered and the package or version is not there. */
export interface AbsentLookupFailure {
  /** Discriminant. */
  readonly kind: 'absent'
}

/** The registry did not answer, so nothing may be concluded. */
export interface UnavailableLookupFailure {
  /** Discriminant. */
  readonly kind: 'unavailable'
  /** Why the registry could not answer. */
  readonly reason: RegistryFailureReason
  /** Diagnostic text pulled from the failed invocation. */
  readonly detail: string
}

/** Subset of a child-process error the classifier reads. */
interface ChildProcessFailure {
  /** Spawn-level error code, for example `ETIMEDOUT` when the timeout elapsed. */
  readonly code?: unknown
  /** Signal used to kill the process, `SIGTERM` when the timeout elapsed. */
  readonly signal?: unknown
  /** Captured standard error. */
  readonly stderr?: unknown
}

const NETWORK_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE']
const AUTH_CODES = ['E401', 'E403', 'ENEEDAUTH', 'EAUTHIP', 'EOTP']
const SERVER_CODES = ['E500', 'E502', 'E503', 'E504']

/**
 * Reads the captured standard error of a failed invocation.
 *
 * @param failure - The caught error
 * @returns The standard error text, empty when none was captured
 */
function readStderr(failure: ChildProcessFailure): string {
  const { stderr } = failure

  if (typeof stderr === 'string') return stderr
  if (stderr instanceof Uint8Array) return createTextDecoder().decode(stderr)
  if (isArray(stderr)) return stderr.join('')

  return ''
}

/**
 * Decides whether a failed `npm view` proves absence or leaves the answer unknown.
 *
 * Only a 404 from the registry proves absence, and npm reports both a missing
 * package and a missing version that way. Every other outcome, including a
 * timeout that produces no output at all, leaves the published state unknown
 * and must not be read as "not published".
 *
 * @param error - The error thrown by the invocation
 * @returns Whether the package is absent, or why the registry could not answer
 *
 * @example Classifying a lookup failure
 * ```typescript
 * try {
 *   execFileSync('npm', ['view', name, 'version'])
 * } catch (error) {
 *   const failure = classifyNpmError(error)
 *   if (failure.kind === 'absent') return null
 *   throw createRegistryUnavailableError({ ...failure, packageName: name })
 * }
 * ```
 */
export function classifyNpmError(error: unknown): NpmLookupFailure {
  const failure = (error ?? {}) as ChildProcessFailure
  const stderr = readStderr(failure)

  if (stderr.includes('E404')) {
    return { kind: 'absent' }
  }

  if (failure.code === 'ETIMEDOUT' || failure.signal === 'SIGTERM') {
    return { kind: 'unavailable', reason: 'timeout', detail: 'the registry did not respond within the configured timeout' }
  }

  const matched = (codes: readonly string[]): string | undefined => codes.find((code) => stderr.includes(code))

  const networkCode = matched(NETWORK_CODES)
  if (networkCode !== undefined) {
    return { kind: 'unavailable', reason: 'network', detail: networkCode }
  }

  const authCode = matched(AUTH_CODES)
  if (authCode !== undefined) {
    return { kind: 'unavailable', reason: 'authentication', detail: authCode }
  }

  const serverCode = matched(SERVER_CODES)
  if (serverCode !== undefined) {
    return { kind: 'unavailable', reason: 'server', detail: serverCode }
  }

  if (stderr.includes('E429')) {
    return { kind: 'unavailable', reason: 'rate-limit', detail: 'E429' }
  }

  const firstLine = stderr.split('\n').find((line) => line.trim() !== '') ?? 'no diagnostic output'

  return { kind: 'unavailable', reason: 'unknown', detail: firstLine.trim() }
}
