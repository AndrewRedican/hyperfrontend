import type { Logger } from '@hyperfrontend/logging'
import type { ProtocolProvider } from '../../channel/model'
import type { SessionCrypto, SessionProtocolDefinition } from './model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidLogger } from '@hyperfrontend/logging'
import { createProtocolError, ProtocolErrorCode } from '../../security/errors'
import { isValidReceiveFn } from '../validations/is-valid-receive-fn'
import { isValidSendFn } from '../validations/is-valid-send-fn'
import { createSessionProtocol } from './create-session-protocol'

/**
 * Creates the provider that binds a session protocol instance to a negotiated session.
 *
 * The provider checks the transport callbacks and that the session was negotiated for this
 * protocol, and refuses anything else in the caller's frame. Everything cryptographic
 * happens after that: the instance mints its material at once and keys the session when the
 * peer's hello is accepted.
 *
 * @param crypto - The platform primitives the protocol seals and opens with
 * @param definition - The protocol's id, version byte, and shared key
 * @param logger - The logger the channel's pipelines log through
 * @returns The function a channel calls to bind a protocol instance to a session
 * @throws {Error} When the logger is not a valid logger
 *
 * @example Composing the v3 provider for a platform
 * ```typescript
 * const protocolProvider = createSessionProtocolProvider(crypto, { id: 'v3', version: 3 }, logger)
 * const channel = createChannel('comms', { send, receive, protocolProvider, session })
 * ```
 */
export function createSessionProtocolProvider(
  crypto: SessionCrypto,
  definition: SessionProtocolDefinition,
  logger: Logger
): ProtocolProvider {
  if (!isValidLogger(logger)) {
    throw createError('Cannot create protocol provider without a valid logger')
  }
  return (send, receive, session) => {
    if (!isValidSendFn(send)) {
      throw createError('Cannot create protocol without a valid send function')
    }
    if (!isValidReceiveFn(receive)) {
      throw createError('Cannot create protocol without a valid receive function')
    }
    if (session.protocol !== definition.id) {
      throw createProtocolError(
        ProtocolErrorCode.InvalidSession,
        `The session was negotiated for '${session.protocol}', not '${definition.id}'`
      )
    }
    return createSessionProtocol({ crypto, definition, session, send, receive, logger })
  }
}
