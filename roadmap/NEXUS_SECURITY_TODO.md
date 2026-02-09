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

- [x] Create `libs/nexus/src/types/security.ts` with `SecurityProtocolVersion` type
- [x] Add `SecurityNegotiationRequest` interface to `security.ts`
- [x] Add `SecurityNegotiationResponse` interface to `security.ts`
- [x] Add `SecurityConfirmation` interface to `security.ts`
- [x] Add `SecurityTransportConfig` interface to `security.ts`
- [x] Add `SecurityTransport` interface to `security.ts`
- [x] Add `ProtocolLoader` type to `security.ts`
- [x] Add `BrokerSecurityConfig` interface to `security.ts`
- [x] Add `ChannelSecuritySettings` interface to `security.ts`
- [x] Export all security types from `libs/nexus/src/types/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus`

### 1.2 Action Interface Extensions

> [Action Type Extensions](NEXUS_SECURITY_INTEGRATION.md#action-type-extensions)

- [x] Extend `IActionBase` with optional `security` property
- [x] Create `IActionWithSecurity` extending `IActionBase`
- [x] Create `IActionWithContractAndSecurity` extending `IActionWithContract`
- [x] Ensure handshake action types accept security fields

> **Checkpoint**: `npx nx typecheck lib-nexus`

### 1.3 Security Transport Directory Structure

> [Appendix: File Structure](NEXUS_SECURITY_INTEGRATION.md#appendix-file-structure)

- [x] Create `libs/nexus/src/security/` directory
- [x] Create `libs/nexus/src/security/index.ts` barrel export
- [x] Create `libs/nexus/src/security/transport/` directory
- [x] Create `libs/nexus/src/security/transport/index.ts` barrel export
- [x] Create `libs/nexus/src/security/transport/types.ts` with internal transport types

### 1.4 NoneTransport Implementation

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [x] Create `libs/nexus/src/security/transport/none-transport.ts`
- [x] Implement `createNoneTransport` factory function with full JSDoc
- [x] Implement passthrough `send` method
- [x] Implement `onReceive` handler registration
- [x] Implement no-op `stop` and `resume` methods
- [x] Implement `isReady` returning `true` always
- [x] Implement `getProtocol` returning `'none'`
- [x] Export from `transport/index.ts`

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus`

### 1.5 SecureTransport Implementation

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [x] Create `libs/nexus/src/security/transport/secure-transport.ts`
- [x] Implement `createSecureTransport` factory function with full JSDoc
- [x] Integrate with network-protocol `ProtocolProvider`
- [x] Implement `send` routing through encryption pipeline
- [x] Implement `onReceive` routing through decryption pipeline
- [x] Implement `stop` and `resume` for backpressure control
- [x] Implement `isReady` checking protocol initialization state
- [x] Implement `getProtocol` returning configured version
- [x] Export from `transport/index.ts`

### 1.6 Security Transport Factory

> [Security Transport Adapter](NEXUS_SECURITY_INTEGRATION.md#1-security-transport-adapter)

- [x] Create `libs/nexus/src/security/transport/factory.ts`
- [x] Implement `createSecurityTransport` with full JSDoc
- [x] Route to `createNoneTransport` when `protocol === 'none'`
- [x] Route to `createSecureTransport` when `protocol === 'v1' | 'v2'`
- [x] Throw descriptive error if provider missing for secure protocols
- [x] Export from `transport/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 1.7 Protocol Registry

> [Protocol Registry (Broker-Level)](NEXUS_SECURITY_INTEGRATION.md#2-protocol-registry-broker-level)

- [x] Create `libs/nexus/src/security/registry/` directory
- [x] Create `libs/nexus/src/security/registry/index.ts` barrel export
- [x] Create `libs/nexus/src/security/registry/types.ts`
- [x] Create `libs/nexus/src/security/registry/factory.ts`
- [x] Implement `createProtocolRegistry` with full JSDoc
- [x] Implement `register(version, provider)` method
- [x] Implement `unregister(version)` method
- [x] Implement `get(version)` method returning provider or undefined
- [x] Implement `has(version)` method
- [x] Implement `getSupportedVersions()` method
- [x] Export registry from `security/index.ts`

### 1.8 Platform Detection Utility

- [x] Create `libs/nexus/src/security/platform.ts`
- [x] Implement `detectPlatform(): 'browser' | 'node'` with full JSDoc
- [x] Use `typeof window` check for browser detection
- [x] Export from `security/index.ts`

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

---

## Phase 2: Handshake Integration

> [Implementation Plan - Phase 2](NEXUS_SECURITY_INTEGRATION.md#phase-2-handshake-integration)

### 2.1 Negotiation Logic

> [Protocol Negotiation Model](NEXUS_SECURITY_INTEGRATION.md#protocol-negotiation-model)

- [x] Create `libs/nexus/src/security/negotiation/` directory
- [x] Create `libs/nexus/src/security/negotiation/index.ts` barrel export
- [x] Create `libs/nexus/src/security/negotiation/types.ts`
- [x] Create `libs/nexus/src/security/negotiation/negotiate.ts`
- [x] Implement `negotiateProtocol(request, responderSupported)` with full JSDoc
- [x] Return first matching protocol from initiator's preference list
- [x] Fallback to `'none'` when no overlap
- [x] Implement `createSecurityRequest(supported, preferred)` helper
- [x] Implement `createSecurityResponse(negotiated, publicParams?)` helper
- [x] Export negotiation functions from `security/index.ts`

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.2 Action Creators Extension

> [Extended Handshake Flow](NEXUS_SECURITY_INTEGRATION.md#extended-handshake-flow)

- [x] Modify `createActionCreators` to accept optional security config
- [x] Update `requestConnection` to include `security` field in action
- [x] Update `acceptConnection` to include `security` negotiation response
- [x] Update `openConnection` to include `security` confirmation
- [x] Ensure backward compatibility when security config is absent

> **Checkpoint**: `npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.3 Handler: handleRequest Modification

> [Handshake Integration](NEXUS_SECURITY_INTEGRATION.md#22-handler-modifications)

- [x] Modify `handleRequest` to extract `security` from incoming action
- [x] Call `negotiateProtocol` with initiator request and responder capabilities
- [x] Store negotiated protocol in channel pending state
- [x] Include security response in accept action
- [x] Maintain backward compatibility: treat missing `security` as `'none'`

### 2.4 Handler: handleAccept Modification

- [x] Modify `handleAccept` to extract negotiated protocol from action
- [x] Initialize appropriate security transport based on negotiated protocol
- [x] Store security transport reference in channel state
- [x] Trigger protocol-specific initialization (key exchange for v2)

### 2.5 Handler: handleOpen Modification

- [x] Modify `handleOpen` to extract security confirmation
- [x] Mark security transport as ready
- [x] Emit `'security-ready'` event on channel

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 2.6 Channel State Extensions

> [Channel State Extensions](NEXUS_SECURITY_INTEGRATION.md#23-channel-state-extensions)

- [x] Add `securityTransport?: SecurityTransport` to channel internals
- [x] Add `negotiatedProtocol?: SecurityProtocolVersion` to channel state
- [x] Add `securityReady: boolean` flag to channel state
- [x] Update channel state initialization to handle security fields

> **Checkpoint**: `npx nx typecheck lib-nexus`

---

## Phase 3: Message Flow Integration

> [Implementation Plan - Phase 3](NEXUS_SECURITY_INTEGRATION.md#phase-3-message-flow-integration)

### 3.1 Outbound Message Flow

> [Outbound Message Flow](NEXUS_SECURITY_INTEGRATION.md#31-outbound-message-flow)

- [x] Modify `send` function to check `securityTransport.isReady()`
- [x] Route outbound actions through `securityTransport.send()` when ready
- [x] Fallback to direct `postMessage` when protocol is `'none'`
- [x] Handle queueing when security transport not yet ready
- [x] Ensure `postMessage` transfer of `Uint8Array` for encrypted payloads

### 3.2 Inbound Message Flow

> [Inbound Message Flow](NEXUS_SECURITY_INTEGRATION.md#32-inbound-message-flow)

- [x] Modify broker `onMessage` to detect `Uint8Array` payloads
- [x] Create `routeEncryptedMessage` function for encrypted dispatch
- [x] Route `Uint8Array` through channel's security transport for decryption
- [x] Route decrypted action to existing message handlers
- [x] Maintain existing flow for plain object messages

### 3.3 Error Handling

> [Error Handling](NEXUS_SECURITY_INTEGRATION.md#33-error-handling)

- [x] Handle decryption failures (invalid key, corrupted payload)
- [x] Handle deobfuscation failures (clock skew, time-window miss)
- [x] Implement retry logic for time-window deobfuscation attempts
- [x] Emit `'security-error'` event with descriptive error payload
- [x] Log security errors using channel's debug logger

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

---

## Phase 4: Broker API Extensions

> [Implementation Plan - Phase 4](NEXUS_SECURITY_INTEGRATION.md#phase-4-broker-api-extensions)

### 4.1 BrokerConfig Extensions

> [Extended Broker Factory](NEXUS_SECURITY_INTEGRATION.md#extended-broker-factory)

- [x] Add `security?: BrokerSecurityConfig` to broker settings interface
- [x] Support `protocols` map for pre-registered providers
- [x] Support `protocolLoader` for lazy loading
- [x] Support `defaultProtocol` for new channels
- [x] Support `defaultSharedKey` for v2 defaults
- [x] Support `defaultRefreshRate` for key rotation

### 4.2 BrokerHandle Extensions

> [Protocol Registry Management](NEXUS_SECURITY_INTEGRATION.md#protocol-registry-management)

- [x] Add `registerProtocol(version, provider)` method to `BrokerHandle`
- [x] Add `unregisterProtocol(version)` method to `BrokerHandle`
- [x] Add `hasProtocol(version)` method to `BrokerHandle`
- [x] Add `getSupportedProtocols()` method to `BrokerHandle`
- [x] Update `BrokerHandle` interface definition

### 4.3 Broker Factory Integration

- [x] Initialize protocol registry in `createBroker`
- [x] Register pre-configured protocols from settings
- [x] Store protocol loader reference for lazy loading
- [x] Pass security config to channel creation

> **Checkpoint**: `npx nx lint lib-nexus && npx nx typecheck lib-nexus && npx nx test lib-nexus`

### 4.4 Channel Settings Extensions

> [Extended Channel Configuration](NEXUS_SECURITY_INTEGRATION.md#extended-channel-configuration)

- [x] Add `security?: ChannelSecuritySettings` to `IChannelSettings`
- [x] Support `protocol` override per channel
- [x] Support `sharedKey` per channel for v2
- [x] Support `refreshRate` per channel
- [x] Support `disabled` flag to opt-out of security

### 4.5 Channel Event Extensions

> [Extended Events](NEXUS_SECURITY_INTEGRATION.md#extended-events)

- [x] Add `'security-negotiated'` event type
- [x] Add `'security-ready'` event type
- [x] Add `'security-error'` event type
- [x] Update `ChannelEvent` union type

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
