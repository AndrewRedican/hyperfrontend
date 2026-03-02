jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

/**
 * Unit Tests: Protocol Negotiation
 *
 * Tests the negotiation algorithm that determines the best security
 * protocol to use between two communicating parties.
 */

import type { SecurityProtocolVersion, SecurityNegotiationRequest } from '../../types/security'
import { negotiateProtocol, createSecurityRequest, createSecurityResponse } from './negotiate'

describe('Protocol Negotiation', () => {
  describe('negotiateProtocol', () => {
    it('selects best matching protocol from preference list', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'v1', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('v2')
      expect(result.isPreferred).toBe(true)
    })

    it('falls back to second choice when preferred not available', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'v1', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('v1')
      expect(result.isPreferred).toBe(false)
    })

    it('falls back to "none" when no overlap', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
      expect(result.isPreferred).toBe(false)
    })

    it('honors initiator preference order', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v1', 'v2', 'none'],
        preferred: 'v1',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('v1')
      expect(result.isPreferred).toBe(true)
    })

    it('requires v2 support on both sides for v2 selection', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
    })

    it('selects v1 when both support v1 but not v2', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'v1', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('v1')
    })

    it('handles empty initiator supported list', () => {
      const request: SecurityNegotiationRequest = {
        supported: [],
        preferred: 'none',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
    })

    it('handles empty responder supported list', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'v1', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = []

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
    })

    it('returns isPreferred true when preferred protocol is negotiated', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v1', 'none'],
        preferred: 'v1',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.isPreferred).toBe(true)
    })

    it('returns isPreferred false when non-preferred protocol is negotiated', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['v2', 'v1', 'none'],
        preferred: 'v2',
      }
      const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.isPreferred).toBe(false)
    })

    it('returns isPreferred true when none is both negotiated and preferred', () => {
      const request: SecurityNegotiationRequest = {
        supported: ['none'],
        preferred: 'none',
      }
      const responderSupported: SecurityProtocolVersion[] = ['none']

      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
      expect(result.isPreferred).toBe(true)
    })
  })

  describe('createSecurityRequest', () => {
    it('creates request with supported protocols and first as preferred', () => {
      const request = createSecurityRequest(['v2', 'v1', 'none'])

      expect(request.supported).toEqual(['v2', 'v1', 'none'])
      expect(request.preferred).toBe('v2')
    })

    it('uses explicit preferred when provided', () => {
      const request = createSecurityRequest(['v2', 'v1', 'none'], 'v1')

      expect(request.supported).toEqual(['v2', 'v1', 'none'])
      expect(request.preferred).toBe('v1')
    })

    it('defaults to "none" for empty supported list', () => {
      const request = createSecurityRequest([])

      expect(request.supported).toEqual(['none'])
      expect(request.preferred).toBe('none')
    })

    it('creates frozen request object', () => {
      const request = createSecurityRequest(['v2', 'v1'])

      expect(Object.isFrozen(request)).toBe(true)
    })

    it('handles single protocol in supported list', () => {
      const request = createSecurityRequest(['v1'])

      expect(request.supported).toEqual(['v1'])
      expect(request.preferred).toBe('v1')
    })
  })

  describe('createSecurityResponse', () => {
    it('creates response with negotiated protocol', () => {
      const response = createSecurityResponse('v2')

      expect(response.negotiated).toBe('v2')
      expect(response.publicParams).toBeUndefined()
    })

    it('includes public params when provided', () => {
      const params = { hint: 'test-value', nonce: 12345 }
      const response = createSecurityResponse('v2', params)

      expect(response.negotiated).toBe('v2')
      expect(response.publicParams).toEqual(params)
    })

    it('creates frozen response object', () => {
      const response = createSecurityResponse('v1')

      expect(Object.isFrozen(response)).toBe(true)
    })

    it('handles "none" as negotiated protocol', () => {
      const response = createSecurityResponse('none')

      expect(response.negotiated).toBe('none')
    })

    it('handles empty public params object', () => {
      const response = createSecurityResponse('v2', {})

      expect(response.publicParams).toEqual({})
    })

    it('handles complex nested public params', () => {
      const params = {
        keyExchange: {
          algorithm: 'ECDH',
          curve: 'P-256',
        },
        nonce: new Uint8Array([1, 2, 3, 4]).toString(),
      }
      const response = createSecurityResponse('v2', params)

      expect(response.publicParams).toEqual(params)
    })
  })
})
