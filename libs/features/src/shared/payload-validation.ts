import type { ValidationError, ValidationResult } from '@hyperfrontend/json-utils'
import type { ActionDescription, FeatureContract } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { validatePayload } from './contract'

// note: Per-action payload enforcement shared by the host shell and hostee feature handles; each side judges by its own contract only.

/**
 * A contract's actions keyed by type, one lookup per direction.
 */
export interface ActionIndex {
  /** Actions this side sends, keyed by action type. */
  emitted: Map<string, ActionDescription>
  /** Actions this side handles, keyed by action type. */
  accepted: Map<string, ActionDescription>
}

/**
 * Indexes an action list by type.
 *
 * @param actions - The action descriptions to index.
 * @returns A map from action type to its description.
 */
function indexActions(actions: ActionDescription[]): Map<string, ActionDescription> {
  return createMap(actions.map((action) => <const>[action.type, action]))
}

/**
 * Formats schema errors as bulleted lines, locating each failure by its JSON path.
 *
 * @param errors - The schema errors to format.
 * @returns The bulleted lines joined by newlines.
 */
function formatErrors(errors: ValidationError[]): string {
  return errors.map((error) => `  - ${error.message} (at ${error.path})`).join('\n')
}

/**
 * Indexes a contract's actions by type for each direction.
 *
 * Built once per handle so validating a payload costs a single map lookup per
 * message instead of a contract scan.
 *
 * @param contract - The side's own contract.
 * @returns The per-direction {@link ActionIndex}.
 *
 * @example Indexing a handle's own contract once
 * ```typescript
 * const index = buildActionIndex(contract)
 * assertSendPayload(index, 'setTimezone', { tz: 'UTC' })
 * ```
 */
export function buildActionIndex(contract: FeatureContract): ActionIndex {
  return { emitted: indexActions(contract.emitted), accepted: indexActions(contract.accepted) }
}

/**
 * Validates an outgoing payload against the sender's own `emitted` schemas.
 *
 * An invalid payload throws in the sender's frame before anything crosses the
 * wire. Actions without a schema, and types the contract does not list, pass
 * through unchanged.
 *
 * @param index - The sender's own {@link ActionIndex}.
 * @param type - The action type being sent.
 * @param payload - The candidate payload.
 * @throws {Error} When the action declares a schema the payload does not satisfy; the message embeds every schema error.
 *
 * @example Guarding a send in the sender's frame
 * ```typescript
 * assertSendPayload(index, 'setTimezone', { tz: 'UTC' })
 * channel.send('setTimezone', { tz: 'UTC' })
 * ```
 */
export function assertSendPayload(index: ActionIndex, type: string, payload: unknown): void {
  const action = index.emitted.get(type)
  if (action === undefined) {
    return
  }
  const result = validatePayload(action, payload)
  if (!result.valid) {
    throw createError(`Invalid payload for action '${type}':\n${formatErrors(result.errors)}`)
  }
}

/**
 * Validates an incoming payload against the receiver's own `accepted` schemas.
 *
 * Returns the result instead of throwing so the receiving handle can drop the
 * message and surface the failure as an `error` event. Actions without a
 * schema, and types the contract does not list, report valid.
 *
 * @param index - The receiver's own {@link ActionIndex}.
 * @param type - The received action type.
 * @param payload - The received payload.
 * @returns The validation result with `valid` and any schema `errors`.
 *
 * @example Dropping an invalid incoming payload
 * ```typescript
 * const result = checkReceivePayload(index, message.type, message.data)
 * if (!result.valid) emitter.emit('error', { reason: 'invalid-payload', type: message.type, errors: result.errors })
 * ```
 */
export function checkReceivePayload(index: ActionIndex, type: string, payload: unknown): ValidationResult {
  const action = index.accepted.get(type)
  if (action === undefined) {
    return { valid: true, errors: [] }
  }
  return validatePayload(action, payload)
}
