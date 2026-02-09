# Nexus Security Layer Integration

**Integrating `@hyperfrontend/network-protocol` into `@hyperfrontend/nexus`**

_Version: 1.0_
_Last Updated: February 9, 2026_

---

## Executive Summary

This document outlines the comprehensive plan for integrating `@hyperfrontend/network-protocol`'s security layer into `@hyperfrontend/nexus` as an optional, pluggable security mechanism. The integration enables encrypted, authenticated communication between browser windows, iframes, web workers, and (in the future) Node.js backends while maintaining backward compatibility with existing nexus consumers.

**Key Goals:**

- **Channel-level security** - Security protocol is configured per-channel, not per-broker
- **Protocol negotiation** - Handshake includes security protocol preference (v1, v2, or none)
- **Pluggable architecture** - Security layer is optional and can be dynamically loaded
- **Isomorphic support** - Support for both browser and Node.js environments
- **Lazy loading** - Protocols loaded on-demand from consumer perspective (CDN/bundle)
- **Backward compatibility** - Existing nexus consumers require no changes

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Integration Design](#integration-design)
3. [Protocol Negotiation Model](#protocol-negotiation-model)
4. [Lazy Loading Strategy](#lazy-loading-strategy)
5. [Implementation Plan](#implementation-plan)
6. [API Surface Changes](#api-surface-changes)
7. [Migration & Compatibility](#migration--compatibility)
8. [Testing Strategy](#testing-strategy)
9. [Future Considerations](#future-considerations)

---

## Current Architecture Analysis

### Nexus Current State

Nexus implements a TCP-like connection protocol using `postMessage` for cross-origin communication:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT NEXUS ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Broker                                                          │
│  ├── Creates and manages channels                               │
│  ├── Routes incoming postMessage events                         │
│  ├── Validates contracts and origins                            │
│  └── Applies security policy (function-based)                   │
│                                                                  │
│  Channel                                                         │
│  ├── Manages connection lifecycle (connect, disconnect, etc.)   │
│  ├── Sends/receives messages via postMessage                    │
│  ├── Validates message types against contract                   │
│  └── Queues messages when connection not active                 │
│                                                                  │
│  Message Flow (Current - Plaintext):                            │
│  ┌──────────┐  postMessage(action)   ┌──────────┐              │
│  │ Channel A │ ──────────────────────▶│ Channel B │              │
│  └──────────┘                        └──────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Current Security Mechanisms:**

- Origin whitelist/blacklist filtering
- Custom security policy function (`SecurityPolicy`)
- Contract validation at connection time

**Gap:** No message encryption or obfuscation - all data transmitted in plaintext via `postMessage`.

### Network-Protocol Current State

Network-protocol provides a multi-layered security pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                 NETWORK-PROTOCOL ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Protocol Provider                                               │
│  ├── Creates Protocol instances with injected send/receive      │
│  ├── Configures encryption (dynamic key or PSK handshake)       │
│  └── Configures obfuscation (time-based password rotation)      │
│                                                                  │
│  Protocol (V1 - Obfuscation-Only Handshake)                     │
│  ├── First message: Obfuscation only (key in payload)          │
│  ├── Key capture: Dynamic key from packet.data.key             │
│  └── Subsequent: Encryption + Obfuscation                       │
│                                                                  │
│  Protocol (V2 - PSK Handshake)                                  │
│  ├── First message: PSK encryption + Obfuscation               │
│  ├── Key capture: Dynamic key from packet.data.key             │
│  └── Subsequent: Dynamic encryption + Obfuscation               │
│                                                                  │
│  Message Flow (With Security):                                   │
│  Plaintext → Encrypt → Serialize → Obfuscate → Uint8Array       │
│  Uint8Array → Deobfuscate → Deserialize → Decrypt → Plaintext   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Available Components:**

- `ProtocolProvider` - Factory for creating Protocol instances
- `ProtocolProviderStore` - Registry for protocol providers
- `Channel` (network-protocol) - Queue-based message processing
- Platform-specific entry points (`browser/v1`, `browser/v2`, `node/v1`, `node/v2`)

---

## Integration Design

### Architectural Approach: Transport Layer Injection

Rather than deeply coupling nexus with network-protocol, we implement a **transport layer abstraction** that allows nexus channels to optionally use network-protocol for message transformation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATED ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Nexus Broker                                                                │
│  ├── Protocol Registry (ProtocolProviderStore)                              │
│  ├── Protocol Loader (lazy loading mechanism)                               │
│  └── Per-channel security configuration                                     │
│                                                                              │
│  Nexus Channel (with security)                                              │
│  ├── Security transport adapter                                             │
│  ├── Handshake security negotiation                                         │
│  └── Message transformation pipeline                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SECURITY TRANSPORT LAYER                           │   │
│  │                                                                        │   │
│  │   ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐    │   │
│  │   │   Nexus     │     │  Security       │     │   postMessage   │    │   │
│  │   │  Channel    │ ──▶ │  Transport      │ ──▶ │   (Uint8Array)  │    │   │
│  │   │  (Action)   │     │  (Encrypt+Obf)  │     │                 │    │   │
│  │   └─────────────┘     └─────────────────┘     └─────────────────┘    │   │
│  │                                                                        │   │
│  │   When security = 'none':                                              │   │
│  │   Nexus Channel ─────────────────────────▶ postMessage(Action)         │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. Security Transport Adapter

A new component that wraps the network-protocol security pipeline and presents a simple send/receive interface to nexus channels:

```typescript
interface SecurityTransport {
  /** Send an action through the security pipeline */
  send(action: IAction): void

  /** Register a handler for decrypted incoming actions */
  onReceive(handler: (action: IAction) => void): void

  /** Stop processing (backpressure) */
  stop(): void

  /** Resume processing */
  resume(): void

  /** Check if transport is ready for encrypted messages */
  isReady(): boolean
}

interface SecurityTransportConfig {
  /** Security protocol version ('v1' | 'v2' | 'none') */
  protocol: SecurityProtocolVersion

  /** Protocol provider (from registry or dynamically loaded) */
  provider?: ProtocolProvider

  /** Pre-shared key (required for v2) */
  sharedKey?: string

  /** Key rotation interval in minutes */
  refreshRate?: number

  /** Target window for postMessage */
  target: Window

  /** Allowed origin for incoming messages */
  origin?: string
}
```

#### 2. Protocol Registry (Broker-Level)

The broker maintains a registry of available protocol providers, allowing dynamic registration and lazy loading:

```typescript
interface BrokerSecurityConfig {
  /** Pre-registered protocol providers */
  protocols?: {
    v1?: ProtocolProvider
    v2?: ProtocolProvider
  }

  /** Protocol loader for lazy loading */
  protocolLoader?: ProtocolLoader

  /** Default security protocol for new channels */
  defaultProtocol?: SecurityProtocolVersion
}

/** Lazy loading function signature */
type ProtocolLoader = (version: 'v1' | 'v2', platform: 'browser' | 'node') => Promise<ProtocolProvider>
```

#### 3. Channel Security Configuration

Each channel can be configured with its own security settings:

```typescript
interface IChannelSettings {
  // Existing settings...
  contract?: IChannelContract | null
  origin?: string
  queueMessages?: boolean
  debug?: boolean
  brokerManaged?: boolean

  // NEW: Security settings
  security?: {
    /** Security protocol version */
    protocol: 'v1' | 'v2' | 'none'

    /** Pre-shared key (required for v2) */
    sharedKey?: string

    /** Key rotation interval in minutes (default: 1) */
    refreshRate?: number

    /** Custom protocol provider (bypasses registry) */
    provider?: ProtocolProvider
  }
}
```

---

## Protocol Negotiation Model

### Extended Handshake Flow

The nexus three-way handshake is extended to include security protocol negotiation:

```
┌─────────────────────┐                              ┌─────────────────────┐
│       HOST A        │                              │       HOST B        │
│     (Initiator)     │                              │     (Responder)     │
└─────────┬───────────┘                              └───────────┬─────────┘
          │                                                      │
          │  1. REQUEST_CONNECTION (plaintext)                   │
          │     {                                                │
          │       type: '[nexus] connection-request',            │
          │       senderId: 'broker-a-id',                       │
          │       processId: 'process-123',                      │
          │       contract: {...},                               │
          │       security: {                        ←── NEW     │
          │         supported: ['v2', 'v1', 'none'], ←── NEW     │
          │         preferred: 'v2'                  ←── NEW     │
          │       }                                  ←── NEW     │
          │     }                                                │
          │ ────────────────────────────────────────────────────▶│
          │                                                      │
          │  2. ACCEPT_CONNECTION (plaintext)                    │
          │     {                                                │
          │       type: '[nexus] connection-request-accepted',   │
          │       senderId: 'broker-b-id',                       │
          │       processId: 'process-123',                      │
          │       contract: {...},                               │
          │       security: {                        ←── NEW     │
          │         negotiated: 'v2',               ←── NEW     │
          │         publicParams: {...}             ←── NEW     │
          │       }                                 ←── NEW     │
          │     }                                                │
          │◀────────────────────────────────────────────────────│
          │                                                      │
          │  3. OPEN_CONNECTION (plaintext or secure)            │
          │     {                                                │
          │       type: '[nexus] connection-opened',             │
          │       senderId: 'broker-a-id',                       │
          │       processId: 'process-123',                      │
          │       security: {                       ←── NEW      │
          │         active: true,                   ←── NEW      │
          │         protocol: 'v2'                  ←── NEW      │
          │       }                                 ←── NEW      │
          │     }                                                │
          │ ────────────────────────────────────────────────────▶│
          │                                                      │
    ═══════════════════════════════════════════════════════════════════
          │         SECURE CHANNEL ESTABLISHED                   │
    ═══════════════════════════════════════════════════════════════════
          │                                                      │
          │  4. NEW_MESSAGE (encrypted + obfuscated if v1/v2)    │
          │     Uint8Array (if secure) or IAction (if 'none')   │
          │ ◀────────────────────────────────────────────────────│
          │                                                      │
```

### Protocol Negotiation Algorithm

```typescript
type SecurityProtocolVersion = 'v1' | 'v2' | 'none'

interface SecurityNegotiationRequest {
  /** Supported protocols in order of preference */
  supported: SecurityProtocolVersion[]
  /** Preferred protocol (first in supported list) */
  preferred: SecurityProtocolVersion
}

interface SecurityNegotiationResponse {
  /** Negotiated protocol (best match) */
  negotiated: SecurityProtocolVersion
  /** Public parameters if needed (e.g., key exchange hints) */
  publicParams?: Record<string, unknown>
}

/**
 * Negotiation algorithm:
 * 1. Responder checks its own configured/supported protocols
 * 2. Finds best match from initiator's supported list
 * 3. Falls back to 'none' if no overlap
 */
function negotiateProtocol(
  initiatorRequest: SecurityNegotiationRequest,
  responderSupported: SecurityProtocolVersion[]
): SecurityProtocolVersion {
  // Find first protocol from initiator's list that responder also supports
  for (const protocol of initiatorRequest.supported) {
    if (responderSupported.includes(protocol)) {
      return protocol
    }
  }

  // Fallback to 'none' - always supported
  return 'none'
}
```

### Action Type Extensions

New properties added to existing action interfaces:

```typescript
// Extended action interfaces
interface IActionWithSecurity extends IActionBase {
  security?: SecurityNegotiationRequest | SecurityNegotiationResponse | SecurityConfirmation
}

interface SecurityConfirmation {
  active: boolean
  protocol: SecurityProtocolVersion
}

// Updated action with contract to include security
interface IActionWithContractAndSecurity extends IActionWithContract {
  security?: SecurityNegotiationRequest
}
```

---

## Lazy Loading Strategy

### Consumer Perspective (Feature Apps)

Feature apps consuming nexus can load security protocols on-demand:

```typescript
// Option 1: Direct import (bundled)
import { createProtocol as createProtocolV2 } from '@hyperfrontend/network-protocol/browser/v2'

const broker = createBroker({
  name: 'feature-app',
  contract: myContract,
  settings: {
    security: {
      protocols: { v2: createProtocolV2(logger, sharedKey, 60) },
    },
  },
})

// Option 2: Dynamic import (code splitting)
const broker = createBroker({
  name: 'feature-app',
  contract: myContract,
  settings: {
    security: {
      protocolLoader: async (version, platform) => {
        const module = await import(`@hyperfrontend/network-protocol/${platform}/${version}`)
        return module.createProtocol(logger, sharedKey, 60)
      },
    },
  },
})

// Option 3: CDN/URL loading (runtime)
const broker = createBroker({
  name: 'feature-app',
  contract: myContract,
  settings: {
    security: {
      protocolLoader: async (version, platform) => {
        const response = await fetch(`https://cdn.example.com/network-protocol/${platform}/${version}.js`)
        const code = await response.text()
        const module = new Function('exports', code)({ exports: {} })
        return module.createProtocol(logger, sharedKey, 60)
      },
    },
  },
})
```

### Provider Perspective (Host Apps)

Host applications embedding features can pre-configure protocols:

```typescript
// Shell application with pre-loaded protocols
import { createProtocol as createV1 } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2 } from '@hyperfrontend/network-protocol/browser/v2'

const broker = createBroker({
  name: 'host-shell',
  contract: shellContract,
  settings: {
    security: {
      protocols: {
        v1: createV1(logger, 60),
        v2: createV2(logger, 'shared-key', 60),
      },
      defaultProtocol: 'v2',
    },
  },
})

// Channels inherit default or specify their own
broker.addChannel('feature-iframe', featureWindow, {
  security: { protocol: 'v2', sharedKey: 'feature-specific-key' },
})
```

### Protocol Registry Management

```typescript
// BrokerHandle extended API
interface BrokerHandle {
  // Existing methods...

  // NEW: Protocol management
  registerProtocol(version: SecurityProtocolVersion, provider: ProtocolProvider): BrokerHandle
  unregisterProtocol(version: SecurityProtocolVersion): BrokerHandle
  hasProtocol(version: SecurityProtocolVersion): boolean
  getSupportedProtocols(): SecurityProtocolVersion[]
}
```

---

## Implementation Plan

### Phase 1: Foundation

**Goal:** Establish the integration infrastructure without disrupting existing functionality.

#### 1.1 Type System Extensions

- [ ] Create `libs/nexus/src/types/security.ts` with security-related types
- [ ] Extend `IAction` interfaces with optional security properties
- [ ] Create `SecurityTransport` interface
- [ ] Add security-related types to exports

```typescript
// libs/nexus/src/types/security.ts
export type SecurityProtocolVersion = 'v1' | 'v2' | 'none'

export interface SecurityNegotiationRequest {
  supported: SecurityProtocolVersion[]
  preferred: SecurityProtocolVersion
}

export interface SecurityNegotiationResponse {
  negotiated: SecurityProtocolVersion
  publicParams?: Record<string, unknown>
}

export interface SecurityTransportConfig {
  protocol: SecurityProtocolVersion
  provider?: unknown // ProtocolProvider from network-protocol
  sharedKey?: string
  refreshRate?: number
  target: Window
  origin?: string
}

export interface SecurityTransport {
  send(action: unknown): void
  onReceive(handler: (action: unknown) => void): void
  stop(): void
  resume(): void
  isReady(): boolean
  getProtocol(): SecurityProtocolVersion
}

export type ProtocolLoader = (version: 'v1' | 'v2', platform: 'browser' | 'node') => Promise<unknown> // ProtocolProvider
```

#### 1.2 Security Transport Adapter

- [ ] Create `libs/nexus/src/security/transport/` directory
- [ ] Implement `createSecurityTransport` factory
- [ ] Implement `NoneTransport` (passthrough, no encryption)
- [ ] Implement `SecureTransport` (wraps network-protocol)

```typescript
// libs/nexus/src/security/transport/factory.ts
export function createSecurityTransport(config: SecurityTransportConfig): SecurityTransport {
  if (config.protocol === 'none') {
    return createNoneTransport(config.target, config.origin)
  }

  if (!config.provider) {
    throw new Error(`Protocol ${config.protocol} requires a provider`)
  }

  return createSecureTransport(config)
}
```

#### 1.3 Protocol Registry

- [ ] Create `libs/nexus/src/security/registry/` directory
- [ ] Implement protocol registration/retrieval
- [ ] Implement protocol loader wrapper
- [ ] Add platform detection utility

### Phase 2: Handshake Integration

**Goal:** Integrate security negotiation into the connection handshake.

#### 2.1 Action Creators Extension

- [ ] Modify `createActionCreators` to support security fields
- [ ] Add `requestConnection` with optional security parameter
- [ ] Add `acceptConnection` with security negotiation response
- [ ] Add `openConnection` with security confirmation

#### 2.2 Handler Modifications

- [ ] Modify `handleRequest` to extract security preferences
- [ ] Implement protocol negotiation logic in `handleRequest`
- [ ] Modify `handleAccept` to initialize security transport
- [ ] Modify `handleOpen` to confirm security activation
- [ ] Add fallback logic for backward compatibility (no security field = 'none')

#### 2.3 Channel State Extensions

- [ ] Add security state to `ChannelState`
- [ ] Add security transport reference to channel internals
- [ ] Modify `sendAction` to route through security transport when active
- [ ] Modify message routing to decrypt through security transport

### Phase 3: Message Flow Integration

**Goal:** Route all post-handshake messages through the security layer.

#### 3.1 Outbound Message Flow

- [ ] Modify `send` in channel to check security transport
- [ ] Route through security transport when active
- [ ] Fallback to direct postMessage when security is 'none'
- [ ] Handle queueing during security initialization

```typescript
// Modified send flow
function send(channel: ChannelInternals, message: IMessage): void {
  const state = channel.getState()

  if (state.securityTransport?.isReady()) {
    // Route through security pipeline
    const action = channel.actions.newMessage(message.data)
    state.securityTransport.send(action)
  } else if (state.security?.protocol === 'none') {
    // Direct send (no security)
    const action = channel.actions.newMessage(message.data)
    sendAction(channel, action)
  } else {
    // Security not ready yet - queue or error
    throw new Error('Security transport not ready')
  }
}
```

#### 3.2 Inbound Message Flow

- [ ] Modify broker onMessage to detect encrypted messages
- [ ] Route Uint8Array messages through security transport
- [ ] Route plain objects through existing handler
- [ ] Handle decryption errors gracefully

```typescript
// Modified broker message handler
const onMessage = (event: MessageEvent) => {
  // Check if message is encrypted (Uint8Array)
  if (event.data instanceof Uint8Array) {
    routeEncryptedMessage(event)
  } else {
    // Plain object - route through existing handlers
    routeMessage(router, state, registry, processManager, actions, event)
  }
}
```

#### 3.3 Error Handling

- [ ] Handle decryption failures (clock skew, invalid key)
- [ ] Implement retry logic for time-window deobfuscation
- [ ] Add security-related error events
- [ ] Log security errors appropriately

### Phase 4: Broker API Extensions

**Goal:** Expose security management through the broker API.

#### 4.1 BrokerConfig Extensions

- [ ] Add `security` field to broker settings
- [ ] Support protocol pre-registration
- [ ] Support default protocol configuration
- [ ] Support protocol loader configuration

#### 4.2 BrokerHandle Extensions

- [ ] Add `registerProtocol` method
- [ ] Add `unregisterProtocol` method
- [ ] Add `hasProtocol` method
- [ ] Add `getSupportedProtocols` method

#### 4.3 Channel Settings Extensions

- [ ] Add `security` field to channel settings
- [ ] Support channel-specific protocol override
- [ ] Support channel-specific shared key
- [ ] Support channel-specific refresh rate

### Phase 5: Testing & Documentation

**Goal:** Comprehensive test coverage and documentation.

#### 5.1 Unit Tests

- [ ] Security transport adapter tests
- [ ] Protocol negotiation tests
- [ ] Handler modification tests
- [ ] Message flow tests with mocked network-protocol

#### 5.2 Integration Tests

- [ ] End-to-end handshake with v1 protocol
- [ ] End-to-end handshake with v2 protocol
- [ ] Mixed protocol negotiation tests
- [ ] Backward compatibility tests (no security field)
- [ ] Error handling tests (clock skew, invalid keys)

#### 5.3 Documentation

- [ ] Update NEXUS_PROTOCOL_ANALYSIS.md with security layer
- [ ] Create security integration guide
- [ ] Add API documentation for new methods
- [ ] Create migration guide for existing consumers

---

## API Surface Changes

### New Dependencies

```json
// libs/nexus/package.json
{
  "peerDependencies": {
    "@hyperfrontend/network-protocol": "^0.0.0"
  },
  "peerDependenciesMeta": {
    "@hyperfrontend/network-protocol": {
      "optional": true
    }
  }
}
```

### Extended Broker Factory

```typescript
// New broker configuration
interface BrokerConfig {
  name: string
  contract: IChannelContract
  settings?: {
    // Existing settings...
    whitelist?: string[]
    blacklist?: string[]
    debug?: boolean
    securityPolicy?: SecurityPolicy

    // NEW: Security configuration
    security?: {
      /** Pre-registered protocol providers */
      protocols?: {
        v1?: ProtocolProvider
        v2?: ProtocolProvider
      }

      /** Dynamic protocol loader */
      protocolLoader?: ProtocolLoader

      /** Default protocol for new channels */
      defaultProtocol?: SecurityProtocolVersion

      /** Shared key for v2 default (can be overridden per-channel) */
      defaultSharedKey?: string

      /** Default key rotation interval */
      defaultRefreshRate?: number
    }
  }
}
```

### Extended Channel Configuration

```typescript
// New channel settings
interface IChannelSettings {
  // Existing settings...
  contract?: IChannelContract | null
  origin?: string
  queueMessages?: boolean
  debug?: boolean
  brokerManaged?: boolean

  // NEW: Channel-specific security
  security?: {
    /** Protocol for this channel */
    protocol?: SecurityProtocolVersion

    /** Channel-specific shared key */
    sharedKey?: string

    /** Channel-specific refresh rate */
    refreshRate?: number

    /** Disable security even if broker has default */
    disabled?: boolean
  }
}
```

### Extended Events

```typescript
// New channel events
type ChannelEvent =
  | 'open'
  | 'close'
  | 'cancel'
  | 'deny'
  | 'error'
  | 'security-negotiated' // NEW: Security protocol negotiated
  | 'security-ready' // NEW: Security transport ready
  | 'security-error' // NEW: Security-related error
```

---

## Migration & Compatibility

### Backward Compatibility Guarantees

1. **Existing consumers unchanged** - Brokers/channels without security configuration behave exactly as before
2. **Gradual adoption** - Security can be added to individual channels without affecting others
3. **Graceful degradation** - If one side doesn't support security, falls back to 'none'
4. **Optional dependency** - network-protocol is a peer dependency, not required

### Migration Path

```typescript
// Step 1: No changes needed - existing code works
const broker = createBroker({
  name: 'my-app',
  contract: myContract,
})

// Step 2: Opt-in to security globally
const broker = createBroker({
  name: 'my-app',
  contract: myContract,
  settings: {
    security: {
      defaultProtocol: 'v1',
      protocolLoader: async (version) => {
        const module = await import(`@hyperfrontend/network-protocol/browser/${version}`)
        return module.createProtocol(logger, 60)
      },
    },
  },
})

// Step 3: Fine-tune per channel
broker.addChannel('secure-feature', secureWindow, {
  security: { protocol: 'v2', sharedKey: 'secret' },
})

broker.addChannel('legacy-feature', legacyWindow, {
  security: { disabled: true }, // No security for this channel
})
```

---

## Testing Strategy

### Test Categories

#### Unit Tests (Mocked Dependencies)

```typescript
describe('Security Transport', () => {
  describe('NoneTransport', () => {
    it('should pass through actions unchanged')
    it('should forward received actions')
    it('should always report ready')
  })

  describe('SecureTransport', () => {
    it('should encrypt outgoing actions')
    it('should decrypt incoming messages')
    it('should report ready after initialization')
    it('should handle stop/resume')
  })
})

describe('Protocol Negotiation', () => {
  it('should select best matching protocol')
  it('should fallback to none when no overlap')
  it('should honor initiator preference order')
  it('should require v2 support for v2 selection')
})
```

#### Integration Tests

```typescript
describe('Secure Handshake', () => {
  it('should negotiate v1 between compatible parties')
  it('should negotiate v2 with shared key')
  it('should fallback to none when initiator has no security')
  it('should fallback to none when responder has no security')
  it('should maintain backward compatibility')
})

describe('Secure Messaging', () => {
  it('should encrypt messages with v1')
  it('should encrypt messages with v2')
  it('should handle clock skew gracefully')
  it('should handle key rotation')
})
```

### Test Environment Setup

```typescript
// Test helpers for network-protocol mocking
const createMockProtocolProvider = (): ProtocolProvider => {
  return (send, receive) => ({
    packetEncryption: async (packet) => ({ ...packet, data: Buffer.from(JSON.stringify(packet.data)) }),
    packetDecryption: async (packet) => ({ ...packet, data: JSON.parse(packet.data.toString()) }),
    packetObfuscation: async (packet) => Buffer.from(packet.data),
    packetDeobfuscation: async (packet) => ({ origin: '', target: '', data: packet.toString() }),
    send,
    receive,
    getLogger: () => mockLogger,
  })
}
```

---

## Future Considerations

### Node.js Backend Channel

When nexus extends to support Node.js back-channels:

```typescript
// Future: Node.js broker
import { createProtocol } from '@hyperfrontend/network-protocol/node/v2'

const broker = createBroker({
  name: 'backend-relay',
  contract: relayContract,
  platform: 'node', // NEW: Platform hint
  settings: {
    security: {
      protocols: { v2: createProtocol(logger, sharedKey, 60) },
    },
  },
})

// Backend channel to WebSocket client
broker.addChannel('ws-client', wsConnection, {
  security: { protocol: 'v2' },
})
```

### Protocol Versioning & Extensibility

The negotiation system supports future protocols:

```typescript
// Future: v3 protocol support
interface SecurityNegotiationRequest {
  supported: ('v3' | 'v2' | 'v1' | 'none')[]
  preferred: 'v3' | 'v2' | 'v1' | 'none'
}

// New protocol registration
broker.registerProtocol('v3', createV3Protocol(logger, config))
```

### Web Worker Support

Network-protocol already supports Web Workers through its isomorphic design:

```typescript
// Worker context
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'

// Main thread to worker communication secured
broker.addChannel('worker', workerPort, {
  security: { protocol: 'v1' },
})
```

### Attestation & Key Distribution

Future enhancements for key distribution:

```typescript
// Future: Automated key distribution
interface SecurityConfig {
  // ...existing

  /** Key distribution mechanism */
  keyDistribution?: {
    method: 'static' | 'attestation' | 'dh-exchange'
    attestationEndpoint?: string
    dhParams?: DHParameters
  }
}
```

---

## Summary

This integration plan enables nexus to leverage network-protocol's security features while:

1. **Maintaining full backward compatibility** - Existing consumers unaffected
2. **Enabling gradual adoption** - Security can be added incrementally
3. **Supporting multiple deployment models** - Bundled, code-split, or CDN-loaded
4. **Preparing for future expansion** - Node.js backends, new protocols, key distribution

The implementation is divided into 5 phases with clear deliverables and test requirements for each phase.

---

## Appendix: File Structure

```
libs/nexus/src/
├── security/
│   ├── index.ts
│   ├── transport/
│   │   ├── index.ts
│   │   ├── factory.ts
│   │   ├── none-transport.ts
│   │   ├── secure-transport.ts
│   │   └── types.ts
│   ├── registry/
│   │   ├── index.ts
│   │   ├── factory.ts
│   │   └── types.ts
│   └── negotiation/
│       ├── index.ts
│       ├── negotiate.ts
│       └── types.ts
├── types/
│   ├── security.ts          (NEW)
│   └── action.ts            (MODIFIED)
├── broker/
│   ├── factory.ts           (MODIFIED)
│   ├── types.ts             (MODIFIED)
│   └── routing/
│       ├── handle-request.ts  (MODIFIED)
│       ├── handle-accept.ts   (MODIFIED)
│       └── handle-open.ts     (MODIFIED)
└── channel/
    ├── types.ts             (MODIFIED)
    ├── factory.ts           (MODIFIED)
    └── messaging/
        ├── send.ts          (MODIFIED)
        └── send-action.ts   (MODIFIED)
```
