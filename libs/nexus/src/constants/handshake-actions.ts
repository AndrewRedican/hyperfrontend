import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { ACTION_TYPES } from '../types/action'

/**
 * Action types that always travel in plaintext.
 *
 * The handshake negotiates security, so both parties must be able to read
 * these before a session exists; every other action crosses the wire sealed
 * once a security transport is attached, and a plaintext copy of one is
 * dropped on arrival.
 */
export const HANDSHAKE_ACTION_TYPES: ReadonlySet<string> = createSet<string>([
  ACTION_TYPES.REQUEST_CONNECTION,
  ACTION_TYPES.ACCEPT_CONNECTION,
  ACTION_TYPES.DENY_CONNECTION,
  ACTION_TYPES.CANCEL_CONNECTION,
  ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED,
  ACTION_TYPES.OPEN_CONNECTION,
])
