/**
 * Security layer barrel export.
 *
 * Provides security transport adapters, protocol registry, negotiation
 * utilities, and error handling for integrating network-protocol security
 * into nexus channels.
 *
 * @module security
 */

export { createNoneTransport, createSecureTransport, createSecurityTransport } from './transport'
export type { NoneTransportConfig, SecureTransportConfig, ErrorHandler } from './transport'

export { createProtocolRegistry } from './registry'
export type { ProtocolRegistry } from './registry'

export { detectPlatform } from './platform'
export type { Platform } from './platform'

export { negotiateProtocol, createSecurityRequest, createSecurityResponse } from './negotiation'
export type { NegotiationResult } from './negotiation'

export { SecurityError, createSecurityErrorEventData, createDeobfuscationRetry, logSecurityError, DEFAULT_RETRY_CONFIG } from './errors'
export type { SecurityErrorCode, RetryConfig } from './errors'
