# Nexus Security Integration - Implementation Checklist

> **Reference**: [NEXUS_SECURITY_INTEGRATION.md](NEXUS_SECURITY_INTEGRATION.md)
>
> **Instructions**: Cross off items by ticking `[x]` when complete. No extensive summaries needed.
>
> **Validation Commands** (run at checkpoints):
>
> - `npx nx typecheck lib-nexus`
> - `npx nx lint lib-nexus`
> - `npx nx test lib-nexus`
> - `npx nx build lib-nexus`
>
> **Implementation Guidelines**:
>
> - Use `<Type>` for typecasting (angle brackets)
> - Use `import type { ... }` for type-only imports from nexus
> - Avoid `any` / `unknown` unless strictly necessary
> - Maintain browser/node isomorphic separation where meaningful
> - Favor complete JSDoc on all exported functions
> - Avoid inline `//` comments unless critical

---

## Phase 1: Foundation

> [Implementation Plan - Phase 1](NEXUS_SECURITY_INTEGRATION.md#phase-1-foundation)

### 1.1 Type System Extensions

- [ ] Create `libs/nexus/src/types/security.ts` with `SecurityProtocolVersion` type
- [ ] Add `SecurityNegotiationRequest` interface to `security.ts`
- [ ] Add `SecurityNegotiationResponse` interface to `security.ts`
- [ ] Add `SecurityConfirmation` interface to `security.ts`
- [ ] Add `SecurityTransportConfig` interface to `security.ts`
- [ ] Add `SecurityTransport` interface to `security.ts`
- [ ] Add `ProtocolLoader` type to `security.ts`
- [ ] Add `BrokerSecurityConfig` interface to `security.ts`
- [ ] Add `ChannelSecuritySettings` interface to `security.ts`
- [ ] Export all security types from `libs/nexus/src/types/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus`

### 1.2 Action Interface Extensions

> [Action Type Extensions](NEXUS_SECURITY_INTEGRATION.md#action-type-extensions)

- [ ] Extend `IActionBase` with optional `security` property
- [ ] Create `IActionWithSecurity` extending `IActionBase`
- [ ] Create `IActionWithContractAndSecurity` extending `IActionWithContract`
- [ ] Ensure handshake action types accept security fields

> **Checkpoint**: `npx nx typecheck lib-nexus`

### 1.3 Security Transport Directory Structure

> [Appendix: File Structure](NEXUS_SECURITY_INTEGRATION.md#appendix-file-structure)

- [ ] Create `libs/nexus/src/security/` directory
- [ ] Create `libs/nexus/src/security/index.ts` barrel export
- [ ] Create `libs/nexus/src/security/transport/` directory
- [ ] Create `libs/nexus/src/security/transport/index.ts` barrel export
- [ ] Create `libs/nexus/src/security/transport/types.ts` with internal transport types

### 1.4 NoneTransport Implementation

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [ ] Create `libs/nexus/src/security/transport/none-transport.ts`
- [ ] Implement `createNoneTransport` factory function with full JSDoc
- [ ] Implement passthrough `send` method
- [ ] Implement `onReceive` handler registration
- [ ] Implement no-op `stop` and `resume` methods
- [ ] Implement `isReady` returning `true` always
- [ ] Implement `getProtocol` returning `'none'`
- [ ] Export from `transport/index.ts`

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus`

### 1.5 SecureTransport Implementation

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [ ] Create `libs/nexus/src/security/transport/secure-transport.ts`
- [ ] Implement `createSecureTransport` factory function with full JSDoc
- [ ] Integrate with network-protocol `ProtocolProvider`
- [ ] Implement `send` routing through encryption pipeline
- [ ] Implement `onReceive` routing through decryption pipeline
- [ ] Implement `stop` and `resume` for backpressure control
- [ ] Implement `isReady` checking protocol initialization state
- [ ] Implement `getProtocol` returning configured version
- [ ] Export from `transport/index.ts`

### 1.6 Security Transport Factory

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [ ] Create `libs/nexus/src/security/transport/factory.ts`
- [ ] Implement `createSecurityTransport` with full JSDoc
- [ ] Route to `createNoneTransport` when `protocol === 'none'`
- [ ] Route to `createSecureTransport` when `protocol === 'v1' | 'v2'`
- [ ] Throw descriptive error if provider missing for secure protocols
- [ ] Export from `transport/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 1.7 Protocol Registry

> [Protocol Registry (Broker-Level)](NEXUS_SECURITY_INTEGRATION.md#2-protocol-registry-broker-level)

- [ ] Create `libs/nexus/src/security/registry/` directory
- [ ] Create `libs/nexus/src/security/registry/index.ts` barrel export
- [ ] Create `libs/nexus/src/security/registry/types.ts`
- [ ] Create `libs/nexus/src/security/registry/factory.ts`
- [ ] Implement `createProtocolRegistry` with full JSDoc
- [ ] Implement `register(version, provider)` method
- [ ] Implement `unregister(version)` method
- [ ] Implement `get(version)` method returning provider or undefined
- [ ] Implement `has(version)` method
- [ ] Implement `getSupportedVersions()` method
- [ ] Export registry from `security/index.ts`

### 1.8 Platform Detection Utility

- [ ] Create `libs/nexus/src/security/platform.ts`
- [ ] Implement `detectPlatform(): 'browser' | 'node'` with full JSDoc
- [ ] Use `typeof window` check for browser detection
- [ ] Export from `security/index.ts`

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

---

## Phase 2: Handshake Integration

> [Implementation Plan - Phase 2](NEXUS_SECURITY_INTEGRATION.md#phase-2-handshake-integration)

### 2.1 Negotiation Logic

> [Protocol Negotiation Model](NEXUS_SECURITY_INTEGRATION.md#protocol-negotiation-model)

- [ ] Create `libs/nexus/src/security/negotiation/` directory
- [ ] Create `libs/nexus/src/security/negotiation/index.ts` barrel export
- [ ] Create `libs/nexus/src/security/negotiation/types.ts`
- [ ] Create `libs/nexus/src/security/negotiation/negotiate.ts`
- [ ] Implement `negotiateProtocol(request, responderSupported)` with full JSDoc
- [ ] Return first matching protocol from initiator's preference list
- [ ] Fallback to `'none'` when no overlap
- [ ] Implement `createSecurityRequest(supported, preferred)` helper
- [ ] Implement `createSecurityResponse(negotiated, publicParams?)` helper
- [ ] Export negotiation functions from `security/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.2 Action Creators Extension

> [Extended Handshake Flow](NEXUS_SECURITY_INTEGRATION.md#extended-handshake-flow)

- [ ] Modify `createActionCreators` to accept optional security config
- [ ] Update `requestConnection` to include `security` field in action
- [ ] Update `acceptConnection` to include `security` negotiation response
- [ ] Update `openConnection` to include `security` confirmation
- [ ] Ensure backward compatibility when security config is absent

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.3 Handler: handleRequest Modification

> [Handshake Integration](NEXUS_SECURITY_INTEGRATION.md#22-handler-modifications)

- [ ] Modify `handleRequest` to extract `security` from incoming action
- [ ] Call `negotiateProtocol` with initiator request and responder capabilities
- [ ] Store negotiated protocol in channel pending state
- [ ] Include security response in accept action
- [ ] Maintain backward compatibility: treat missing `security` as `'none'`

### 2.4 Handler: handleAccept Modification

- [ ] Modify `handleAccept` to extract negotiated protocol from action
- [ ] Initialize appropriate security transport based on negotiated protocol
- [ ] Store security transport reference in channel state
- [ ] Trigger protocol-specific initialization (key exchange for v2)

### 2.5 Handler: handleOpen Modification

- [ ] Modify `handleOpen` to extract security confirmation
- [ ] Mark security transport as ready
- [ ] Emit `'security-ready'` event on channel

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.6 Channel State Extensions

> [Channel State Extensions](NEXUS_SECURITY_INTEGRATION.md#23-channel-state-extensions)

- [ ] Add `securityTransport?: SecurityTransport` to channel internals
- [ ] Add `negotiatedProtocol?: SecurityProtocolVersion` to channel state
- [ ] Add `securityReady: boolean` flag to channel state
- [ ] Update channel state initialization to handle security fields

> **Checkpoint**: `npx nx typecheck lib-nexus`

---

## Phase 3: Message Flow Integration

> [Implementation Plan - Phase 3](NEXUS_SECURITY_INTEGRATION.md#phase-3-message-flow-integration)

### 3.1 Outbound Message Flow

> [Outbound Message Flow](NEXUS_SECURITY_INTEGRATION.md#31-outbound-message-flow)

- [ ] Modify `send` function to check `securityTransport.isReady()`
- [ ] Route outbound actions through `securityTransport.send()` when ready
- [ ] Fallback to direct `postMessage` when protocol is `'none'`
- [ ] Handle queueing when security transport not yet ready
- [ ] Ensure `postMessage` transfer of `Uint8Array` for encrypted payloads

### 3.2 Inbound Message Flow

> [Inbound Message Flow](NEXUS_SECURITY_INTEGRATION.md#32-inbound-message-flow)

- [ ] Modify broker `onMessage` to detect `Uint8Array` payloads
- [ ] Create `routeEncryptedMessage` function for encrypted dispatch
- [ ] Route `Uint8Array` through channel's security transport for decryption
- [ ] Route decrypted action to existing message handlers
- [ ] Maintain existing flow for plain object messages

### 3.3 Error Handling

> [Error Handling](NEXUS_SECURITY_INTEGRATION.md#33-error-handling)

- [ ] Handle decryption failures (invalid key, corrupted payload)
- [ ] Handle deobfuscation failures (clock skew, time-window miss)
- [ ] Implement retry logic for time-window deobfuscation attempts
- [ ] Emit `'security-error'` event with descriptive error payload
- [ ] Log security errors using channel's debug logger

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

---

## Phase 4: Broker API Extensions

> [Implementation Plan - Phase 4](NEXUS_SECURITY_INTEGRATION.md#phase-4-broker-api-extensions)

### 4.1 BrokerConfig Extensions

> [Extended Broker Factory](NEXUS_SECURITY_INTEGRATION.md#extended-broker-factory)

- [ ] Add `security?: BrokerSecurityConfig` to broker settings interface
- [ ] Support `protocols` map for pre-registered providers
- [ ] Support `protocolLoader` for lazy loading
- [ ] Support `defaultProtocol` for new channels
- [ ] Support `defaultSharedKey` for v2 defaults
- [ ] Support `defaultRefreshRate` for key rotation

### 4.2 BrokerHandle Extensions

> [Protocol Registry Management](NEXUS_SECURITY_INTEGRATION.md#protocol-registry-management)

- [ ] Add `registerProtocol(version, provider)` method to `BrokerHandle`
- [ ] Add `unregisterProtocol(version)` method to `BrokerHandle`
- [ ] Add `hasProtocol(version)` method to `BrokerHandle`
- [ ] Add `getSupportedProtocols()` method to `BrokerHandle`
- [ ] Update `BrokerHandle` interface definition

### 4.3 Broker Factory Integration

- [ ] Initialize protocol registry in `createBroker`
- [ ] Register pre-configured protocols from settings
- [ ] Store protocol loader reference for lazy loading
- [ ] Pass security config to channel creation

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 4.4 Channel Settings Extensions

> [Extended Channel Configuration](NEXUS_SECURITY_INTEGRATION.md#extended-channel-configuration)

- [ ] Add `security?: ChannelSecuritySettings` to `IChannelSettings`
- [ ] Support `protocol` override per channel
- [ ] Support `sharedKey` per channel for v2
- [ ] Support `refreshRate` per channel
- [ ] Support `disabled` flag to opt-out of security

### 4.5 Channel Event Extensions

> [Extended Events](NEXUS_SECURITY_INTEGRATION.md#extended-events)

- [ ] Add `'security-negotiated'` event type
- [ ] Add `'security-ready'` event type
- [ ] Add `'security-error'` event type
- [ ] Update `ChannelEvent` union type

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

---

## Phase 5: Testing & Documentation

> [Implementation Plan - Phase 5](NEXUS_SECURITY_INTEGRATION.md#phase-5-testing--documentation)

### 5.1 Unit Tests - Transport

> [Testing Strategy](NEXUS_SECURITY_INTEGRATION.md#testing-strategy)

- [ ] Create `libs/nexus/src/security/transport/__tests__/` directory
- [ ] Add tests: `NoneTransport` passes through actions unchanged
- [ ] Add tests: `NoneTransport` forwards received actions
- [ ] Add tests: `NoneTransport` always reports ready
- [ ] Add tests: `SecureTransport` encrypts outgoing actions
- [ ] Add tests: `SecureTransport` decrypts incoming messages
- [ ] Add tests: `SecureTransport` reports ready after initialization
- [ ] Add tests: `SecureTransport` handles stop/resume

### 5.2 Unit Tests - Negotiation

- [ ] Create `libs/nexus/src/security/negotiation/__tests__/` directory
- [ ] Add tests: selects best matching protocol from preference list
- [ ] Add tests: falls back to `'none'` when no overlap
- [ ] Add tests: honors initiator preference order
- [ ] Add tests: requires v2 support on both sides for v2 selection

### 5.3 Unit Tests - Registry

- [ ] Create `libs/nexus/src/security/registry/__tests__/` directory
- [ ] Add tests: registers and retrieves protocol providers
- [ ] Add tests: unregisters protocol providers
- [ ] Add tests: returns supported versions list

> **Checkpoint**: `npx nx test lib-nexus`

### 5.4 Integration Tests

- [ ] Create `libs/nexus/src/__tests__/security-integration.spec.ts`
- [ ] Add tests: negotiate v1 between compatible parties
- [ ] Add tests: negotiate v2 with shared key
- [ ] Add tests: fallback to `'none'` when initiator has no security
- [ ] Add tests: fallback to `'none'` when responder has no security
- [ ] Add tests: backward compatibility with no security field
- [ ] Add tests: encrypt/decrypt messages with v1
- [ ] Add tests: encrypt/decrypt messages with v2
- [ ] Add tests: handle clock skew gracefully
- [ ] Add tests: handle key rotation

> **Checkpoint**: `npx nx test lib-nexus`

### 5.5 Documentation

- [ ] Update `NEXUS_PROTOCOL_ANALYSIS.md` with security layer section
- [ ] Create `docs/content/docs/nexus/security-integration.md` guide
- [ ] Add API documentation for new broker methods
- [ ] Add API documentation for new channel security settings
- [ ] Create migration guide for existing consumers

> **Checkpoint**: `npx nx build lib-nexus`

---

## Final Validation

- [ ] Run `npx nx lint lib-nexus` - all lint rules pass
- [ ] Run `npx nx typecheck lib-nexus` - no type errors
- [ ] Run `npx nx test lib-nexus` - all tests pass
- [ ] Run `npx nx build lib-nexus` - build succeeds
- [ ] Verify optional peer dependency on `@hyperfrontend/network-protocol`
- [ ] Verify backward compatibility: existing consumer code unchanged
