import type { ProtocolSession } from '../../security/model'
import { getType } from '@hyperfrontend/data-utils'

const ROLES: readonly string[] = ['initiator', 'responder']

const isNonEmptyString = (value: unknown): value is string => getType(value) === 'string' && (value as string).length > 0

/**
 * Checks that a value has the shape of a protocol session: a protocol id, a role, and
 * both identities.
 *
 * @param session - The value to check
 * @returns True when the value has the shape of a `ProtocolSession`
 *
 * @example Guarding a session before binding a protocol to it
 * ```typescript
 * isValidSession({ protocol: 'v3', role: 'initiator', localId, peerId })
 * // => true
 * ```
 */
export function isValidSession(session: unknown): session is ProtocolSession {
  if (getType(session) !== 'object') {
    return false
  }
  const candidate = session as ProtocolSession
  return (
    isNonEmptyString(candidate.protocol) &&
    ROLES.includes(candidate.role) &&
    isNonEmptyString(candidate.localId) &&
    isNonEmptyString(candidate.peerId)
  )
}
