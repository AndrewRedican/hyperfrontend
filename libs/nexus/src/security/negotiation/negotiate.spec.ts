import type { SecurityNegotiationRequest, SecurityProtocolVersion } from '../../types/security'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createSecurityRequest, createSecurityResponse, negotiateProtocol } from './negotiate'
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

describe('Protocol Negotiation', () => {
  describe('negotiateProtocol', () => {
    it('selects the first protocol both sides support', () => {
      const request: SecurityNegotiationRequest = { supported: ['v4', 'v3', 'none'], preferred: 'v4' }
      const responderSupported: SecurityProtocolVersion[] = ['v4', 'v3', 'none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'v4', isPreferred: true })
    })

    it('falls back to the next choice when the preferred protocol is unsupported', () => {
      const request: SecurityNegotiationRequest = { supported: ['v4', 'v3', 'none'], preferred: 'v4' }
      const responderSupported: SecurityProtocolVersion[] = ['v3', 'none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'v3', isPreferred: false })
    })

    it('falls back to none when nothing overlaps', () => {
      const request: SecurityNegotiationRequest = { supported: ['v4'], preferred: 'v4' }
      const responderSupported: SecurityProtocolVersion[] = ['v3']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'none', isPreferred: false })
    })

    it("honours the initiator's order over the responder's", () => {
      const request: SecurityNegotiationRequest = { supported: ['v3', 'v4', 'none'], preferred: 'v3' }
      const responderSupported: SecurityProtocolVersion[] = ['v4', 'v3', 'none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'v3', isPreferred: true })
    })

    it('requires v4 support on both sides', () => {
      const request: SecurityNegotiationRequest = { supported: ['v4', 'none'], preferred: 'v4' }
      const responderSupported: SecurityProtocolVersion[] = ['v3', 'none']

      expect(negotiateProtocol(request, responderSupported).negotiated).toBe('none')
    })

    it('accepts an external protocol identifier', () => {
      const request: SecurityNegotiationRequest = { supported: ['acme-x25519', 'none'], preferred: 'acme-x25519' }
      const responderSupported: SecurityProtocolVersion[] = ['acme-x25519', 'none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'acme-x25519', isPreferred: true })
    })

    it('falls back to none for an empty initiator list', () => {
      const request: SecurityNegotiationRequest = { supported: [], preferred: 'none' }
      const responderSupported: SecurityProtocolVersion[] = ['v4', 'v3', 'none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'none', isPreferred: true })
    })

    it('falls back to none for an empty responder list', () => {
      const request: SecurityNegotiationRequest = { supported: ['v4', 'v3', 'none'], preferred: 'v4' }
      const responderSupported: SecurityProtocolVersion[] = []

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'none', isPreferred: false })
    })

    it('reports none as preferred when it is both negotiated and preferred', () => {
      const request: SecurityNegotiationRequest = { supported: ['none'], preferred: 'none' }
      const responderSupported: SecurityProtocolVersion[] = ['none']

      expect(negotiateProtocol(request, responderSupported)).toEqual({ negotiated: 'none', isPreferred: true })
    })
  })

  describe('createSecurityRequest', () => {
    it('prefers the first supported protocol', () => {
      expect(createSecurityRequest(['v4', 'v3', 'none'])).toEqual({ supported: ['v4', 'v3', 'none'], preferred: 'v4' })
    })

    it('uses the explicit preference', () => {
      expect(createSecurityRequest(['v4', 'v3', 'none'], 'v3')).toEqual({ supported: ['v4', 'v3', 'none'], preferred: 'v3' })
    })

    it('defaults to none for an empty supported list', () => {
      expect(createSecurityRequest([])).toEqual({ supported: ['none'], preferred: 'none' })
    })

    it('handles a single supported protocol', () => {
      expect(createSecurityRequest(['v3'])).toEqual({ supported: ['v3'], preferred: 'v3' })
    })

    it('freezes the request', () => {
      expect(Object.isFrozen(createSecurityRequest(['v4', 'v3']))).toBe(true)
    })
  })

  describe('createSecurityResponse', () => {
    it('carries only the negotiated protocol', () => {
      expect(createSecurityResponse('v4')).toStrictEqual({ negotiated: 'v4' })
    })

    it('carries none', () => {
      expect(createSecurityResponse('none')).toStrictEqual({ negotiated: 'none' })
    })

    it('carries an external protocol identifier', () => {
      expect(createSecurityResponse('acme-x25519')).toStrictEqual({ negotiated: 'acme-x25519' })
    })

    it('freezes the response', () => {
      expect(Object.isFrozen(createSecurityResponse('v3'))).toBe(true)
    })
  })
})
