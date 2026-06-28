import type { FeatureContract } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Reserved namespace for SDK-internal control traffic (heartbeat, sizing); these ride the consumer's feature channel but are filtered out before reaching consumer handlers, keeping the consumer's event stream clean.
const CONTROL_PREFIX = '__hf:'

/**
 * Internal control message types carried on the feature channel and hidden from consumers.
 */
export const ControlType = freeze(<const>{
  /** Hostee-to-host liveness beat. */
  Beat: '__hf:beat',
  /** Hostee-to-host content-size announcement. */
  Size: '__hf:size',
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
  return {
    emitted: [...contract.emitted, { type: ControlType.Beat }, { type: ControlType.Size }],
    accepted: [...contract.accepted, { type: ControlType.Beat }, { type: ControlType.Size }],
  }
}
