import type { FeatureContract } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Reserved namespace for SDK-internal control traffic (heartbeat, presentation); these ride the consumer's feature channel but are filtered out before reaching consumer handlers, keeping the consumer's event stream clean.
const CONTROL_PREFIX = '__hf:'

/**
 * Internal control message types carried on the feature channel and hidden from consumers.
 */
export const ControlType = freeze(<const>{
  /** Hostee-to-host liveness beat. */
  Beat: '__hf:beat',
  /** Host-to-hostee presentation announcement, first message after open: the display mode, the frame's initial dimensions, and any agreed dialog box geometry. */
  Present: '__hf:present',
  /** Host-to-hostee report that the frame's usable space **changed**, as exact pixel dimensions (iframe modes only; the initial size travels in the presentation announcement). */
  Viewport: '__hf:viewport',
  /** Hostee-to-host report of a dismiss interaction it detected: a backdrop pointer press or an in-frame Escape (dialog mode only). Purely a signal: it tears nothing down itself; the host applies its configured policy, and any teardown still runs through the ordinary close exchange. */
  Dismiss: '__hf:dismiss',
  /** Correlated request envelope carrying a consumer request in either direction. */
  Request: '__hf:request',
  /** Correlated response envelope answering a request. */
  Response: '__hf:response',
  /** Hostee-to-host page-visibility report, so silence while hidden is not read as failure. */
  Visibility: '__hf:visibility',
  /** Hostee-to-host declaration that it holds (or no longer holds) unsaved work. */
  Dirty: '__hf:dirty',
})

/**
 * Union of the reserved control message types.
 */
export type ControlType = (typeof ControlType)[keyof typeof ControlType]

/**
 * Reports whether a wire message type is SDK-internal control traffic.
 *
 * @param type - The message type to test.
 * @returns `true` when the type is reserved for the control plane.
 *
 * @example Filtering control traffic before re-emitting to consumers
 * ```typescript
 * if (isControlType(message.type)) return
 * emitter.emit(message.type, message.data)
 * ```
 */
export function isControlType(type: string): boolean {
  return type.startsWith(CONTROL_PREFIX)
}

/**
 * Extends a feature contract so the channel may also send and receive control traffic.
 *
 * @param contract - The consumer-facing feature contract.
 * @returns A contract that additionally permits the reserved control types.
 *
 * @example Building a broker contract that carries the control plane
 * ```typescript
 * const broker = createBroker({ name, contract: withControlContract(contract) })
 * ```
 */
export function withControlContract(contract: FeatureContract): FeatureContract {
  // note: Fresh action literals per direction — sharing references across emitted/accepted trips nexus's circular-reference guard, which flags any repeated object.
  const controlActions = () => [
    { type: ControlType.Beat },
    { type: ControlType.Present },
    { type: ControlType.Viewport },
    { type: ControlType.Dismiss },
    { type: ControlType.Request },
    { type: ControlType.Response },
    { type: ControlType.Visibility },
    { type: ControlType.Dirty },
  ]
  return {
    emitted: [...contract.emitted, ...controlActions()],
    accepted: [...contract.accepted, ...controlActions()],
    ...(contract.version !== undefined && { version: contract.version }),
  }
}
