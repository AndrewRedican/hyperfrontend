/**
 * Protocol negotiation logic for security handshake.
 *
 * Implements the negotiation algorithm that determines the best
 * security protocol to use between two communicating parties.
 *
 * @module security/negotiation/negotiate
 */

import type { SecurityProtocolVersion, SecurityNegotiationRequest, SecurityNegotiationResponse } from '../../types/security'
import type { NegotiationResult } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Negotiates the best security protocol between initiator and responder.
 *
 * The algorithm iterates through the initiator's supported protocols
 * (in preference order) and selects the first one that the responder
 * also supports. If no overlap is found, falls back to 'none'.
 *
 * @param request - The initiator's security negotiation request
 * @param responderSupported - Protocols supported by the responder
 * @returns The negotiation result with the selected protocol
 *
 * @example Negotiating security protocol
 * ```typescript
 * const request = { supported: ['v2', 'v1', 'none'], preferred: 'v2' }
 * const responderSupported = ['v1', 'none']
 * const result = negotiateProtocol(request, responderSupported)
 * // result.negotiated === 'v1' (first match from initiator's list)
 * ```
 */
export function negotiateProtocol(
  request: SecurityNegotiationRequest,
  responderSupported: readonly SecurityProtocolVersion[]
): NegotiationResult {
  for (const protocol of request.supported) {
    if (responderSupported.includes(protocol)) {
      return {
        negotiated: protocol,
        isPreferred: protocol === request.preferred,
      }
    }
  }

  return {
    negotiated: 'none',
    isPreferred: request.preferred === 'none',
  }
}

/**
 * Creates a security negotiation request for the initiator.
 *
 * Builds a request object containing the list of supported protocols
 * (in preference order) and the preferred protocol.
 *
 * @param supported - Protocols supported by the initiator (in preference order)
 * @param preferred - The initiator's preferred protocol (defaults to first in list)
 * @returns A security negotiation request object
 *
 * @example Creating initiator request
 * ```typescript
 * const request = createSecurityRequest(['v2', 'v1', 'none'])
 * // { supported: ['v2', 'v1', 'none'], preferred: 'v2' }
 * ```
 */
export function createSecurityRequest(
  supported: readonly SecurityProtocolVersion[],
  preferred?: SecurityProtocolVersion
): SecurityNegotiationRequest {
  const effectiveSupported = supported.length > 0 ? supported : <readonly SecurityProtocolVersion[]>['none']
  const effectivePreferred = preferred ?? effectiveSupported[0]

  return freeze({
    supported: effectiveSupported,
    preferred: effectivePreferred,
  })
}

/**
 * Creates a security negotiation response for the responder.
 *
 * Builds a response object containing the negotiated protocol
 * and optional public parameters for protocol initialization.
 *
 * @param negotiated - The negotiated protocol version
 * @param publicParams - Optional public parameters (e.g., key exchange hints)
 * @returns A security negotiation response object
 *
 * @example Creating responder response
 * ```typescript
 * const response = createSecurityResponse('v2', { hint: 'value' })
 * // { negotiated: 'v2', publicParams: { hint: 'value' } }
 * ```
 */
export function createSecurityResponse(
  negotiated: SecurityProtocolVersion,
  publicParams?: Readonly<Record<string, unknown>>
): SecurityNegotiationResponse {
  const response: SecurityNegotiationResponse = publicParams ? { negotiated, publicParams } : { negotiated }

  return freeze(response)
}
