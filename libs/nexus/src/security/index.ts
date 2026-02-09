/**
 * Security layer barrel export.
 *
 * Provides security transport adapters, protocol registry, and negotiation
 * utilities for integrating network-protocol security into nexus channels.
 *
 * @module security
 */

export { createNoneTransport, createSecureTransport, createSecurityTransport } from './transport'
export type { NoneTransportConfig, SecureTransportConfig } from './transport'

export { createProtocolRegistry } from './registry'
export type { ProtocolRegistry } from './registry'

export { detectPlatform } from './platform'
export type { Platform } from './platform'

export { negotiateProtocol, createSecurityRequest, createSecurityResponse } from './negotiation'
export type { NegotiationResult } from './negotiation'
