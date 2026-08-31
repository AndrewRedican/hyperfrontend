import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { assign } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Why a registry could not answer a lookup.
 *
 * Every value here means the answer is unknown, never that the package or
 * version is absent. An absent package is a successful lookup with a negative
 * answer, and is reported through the normal return value instead.
 */
export type RegistryFailureReason = 'network' | 'authentication' | 'rate-limit' | 'server' | 'timeout' | 'unknown'

/** Name carried by every error this module raises, used to identify it across module boundaries. */
export const REGISTRY_UNAVAILABLE_ERROR = 'RegistryUnavailableError'

/**
 * Error raised when a registry lookup could not be completed.
 *
 * Distinct from a lookup that completed and found nothing: this means the
 * registry did not give an answer, so no release decision may be derived from
 * it.
 */
export interface RegistryUnavailableError extends Error {
  /** Always {@link REGISTRY_UNAVAILABLE_ERROR}. */
  readonly name: string
  /** Registry that was queried, for example `npm`. */
  readonly registry: string
  /** Package the lookup was for. */
  readonly packageName: string
  /** Client operation that failed, for example `getLatestVersion`. */
  readonly operation: string
  /** Why the registry could not answer. */
  readonly reason: RegistryFailureReason
}

/** Details identifying the failed lookup. */
export interface RegistryUnavailableDetails {
  /** Registry that was queried, for example `npm`. */
  readonly registry: string
  /** Package the lookup was for. */
  readonly packageName: string
  /** Client operation that failed, for example `getLatestVersion`. */
  readonly operation: string
  /** Why the registry could not answer. */
  readonly reason: RegistryFailureReason
  /** Diagnostic text from the underlying client, included in the message. */
  readonly detail?: string
}

/**
 * Creates an error describing a registry that could not answer a lookup.
 *
 * @param details - Which lookup failed, against which registry, and why
 * @returns An error carrying the failure details
 *
 * @example Reporting an unreachable registry
 * ```typescript
 * throw createRegistryUnavailableError({
 *   registry: 'npm',
 *   packageName: '@scope/pkg',
 *   operation: 'getLatestVersion',
 *   reason: 'network',
 *   detail: 'ECONNREFUSED',
 * })
 * ```
 */
export function createRegistryUnavailableError(details: RegistryUnavailableDetails): RegistryUnavailableError {
  const { registry, packageName, operation, reason, detail } = details
  const suffix = detail === undefined || detail === '' ? '' : `: ${detail}`
  const error = createError(
    `Could not determine the published state of ${packageName} from the ${registry} registry (${reason})${suffix}. ` +
      `Releasing without an answer risks publishing over or below what is already there, so the run stops here.`
  )

  return assign(error, {
    name: REGISTRY_UNAVAILABLE_ERROR,
    registry,
    packageName,
    operation,
    reason,
  })
}

/**
 * Checks whether a value is a {@link RegistryUnavailableError}.
 *
 * @param value - Value to test, typically a caught error
 * @returns True when the value reports a registry that could not answer
 *
 * @example Distinguishing an unreachable registry from other failures
 * ```typescript
 * try {
 *   await registry.getLatestVersion('@scope/pkg')
 * } catch (error) {
 *   if (isRegistryUnavailableError(error)) {
 *     logger.error(error.message)
 *   }
 * }
 * ```
 */
export function isRegistryUnavailableError(value: unknown): value is RegistryUnavailableError {
  return value instanceof Error && value.name === REGISTRY_UNAVAILABLE_ERROR
}
