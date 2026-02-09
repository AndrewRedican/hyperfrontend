---
title: Nexus Security Integration
weight: 5
---

# Nexus Security Integration Guide

This guide covers the security layer integration for `@hyperfrontend/nexus`, enabling encrypted message exchange between browser contexts.

## Overview

Nexus provides optional end-to-end encryption through integration with `@hyperfrontend/network-protocol`. The security layer:

- Encrypts message payloads before transmission
- Decrypts received messages automatically
- Negotiates the best available protocol during handshake
- Supports key rotation for long-running sessions

## Security Protocol Versions

| Version | Description | Best For |
|---------|-------------|----------|
| `none` | No encryption (passthrough) | Trusted environments, debugging |
| `v1` | Obfuscation with dynamic key exchange | Basic protection |
| `v2` | Pre-shared key with key rotation | High-security scenarios |

## Quick Start

### Basic Setup with Security

```typescript
import { createBroker } from '@hyperfrontend/nexus'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ prefix: 'nexus' })

const broker = createBroker({
  name: 'secure-broker',
  contract: {
    emitted: [{ type: 'PING' }],
    accepted: [{ type: 'PONG' }],
  },
  settings: {
    security: {
      protocols: {
        v2: createProtocol(logger, 'my-shared-key', 60),
      },
      defaultProtocol: 'v2',
    },
  },
})
```

### Creating a Secure Channel

```typescript
const channel = broker.addChannel('secure-channel', iframe.contentWindow)

channel.on((event, data) => {
  if (event === 'security-ready') {
    console.log('Secure connection established!')
    channel.send('PING', { timestamp: Date.now() })
  }
})

channel.connect()
```

## Broker Configuration

### BrokerSecurityConfig

| Property | Type | Description |
|----------|------|-------------|
| `protocols` | `{ v1?: Provider, v2?: Provider }` | Pre-registered protocol providers |
| `protocolLoader` | `(version, platform) => Promise<Provider>` | Lazy loader for protocols |
| `defaultProtocol` | `'none' \| 'v1' \| 'v2'` | Default protocol for new channels |
| `defaultSharedKey` | `string` | Default PSK for v2 protocol |
| `defaultRefreshRate` | `number` | Key rotation interval (minutes) |

### Example: Full Configuration

```typescript
const broker = createBroker({
  name: 'enterprise-broker',
  contract: myContract,
  settings: {
    security: {
      protocols: {
        v1: createV1Protocol(logger, 60),
        v2: createV2Protocol(logger, 'enterprise-key', 30),
      },
      defaultProtocol: 'v2',
      defaultSharedKey: 'enterprise-key',
      defaultRefreshRate: 30,
    },
  },
})
```

## Channel Security Settings

Override broker defaults per-channel:

### ChannelSecuritySettings

| Property | Type | Description |
|----------|------|-------------|
| `protocol` | `'none' \| 'v1' \| 'v2'` | Protocol override |
| `sharedKey` | `string` | Channel-specific PSK |
| `refreshRate` | `number` | Key rotation interval |
| `disabled` | `boolean` | Opt-out of security |

### Example: Channel Override

```typescript
// High-security channel with faster key rotation
const adminChannel = broker.addChannel('admin', adminWindow, {
  security: {
    protocol: 'v2',
    sharedKey: 'admin-specific-key',
    refreshRate: 5, // Rotate keys every 5 minutes
  },
})

// Debugging channel with no encryption
const debugChannel = broker.addChannel('debug', debugWindow, {
  security: {
    disabled: true,
  },
})
```

## Protocol Registry API

Manage protocols dynamically:

```typescript
// Register a new protocol provider
broker.registerProtocol('v2', createProtocol(logger, 'key', 60))

// Check if a protocol is available
if (broker.hasProtocol('v2')) {
  console.log('V2 encryption available')
}

// Get all supported protocols
const protocols = broker.getSupportedProtocols()
// ['v2', 'none']

// Unregister a protocol
broker.unregisterProtocol('v2')
```

## Security Events

### Event Types

| Event | Payload | When |
|-------|---------|------|
| `security-negotiated` | `{ protocol, isPreferred }` | Protocol agreed upon |
| `security-ready` | `{ protocol }` | Transport initialized |
| `security-error` | `{ message, code, cause? }` | Security failure |

### Error Codes

| Code | Description |
|------|-------------|
| `decryption_failed` | Message decryption failed |
| `deobfuscation_failed` | Time-based deobfuscation failed |
| `transport_error` | Transport-level failure |
| `unknown` | Unclassified error |

### Example: Event Handling

```typescript
channel.on((event, data) => {
  switch (event) {
    case 'security-negotiated':
      console.log(`Protocol: ${data.protocol}`)
      console.log(`Was preferred: ${data.isPreferred}`)
      break

    case 'security-ready':
      console.log(`Secure with ${data.protocol}`)
      break

    case 'security-error':
      console.error(`Error [${data.code}]: ${data.message}`)
      if (data.cause) {
        console.error('Cause:', data.cause)
      }
      break
  }
})
```

## Protocol Negotiation

### How Negotiation Works

1. **Initiator** sends supported protocols in preference order
2. **Responder** selects the first mutually-supported protocol
3. Falls back to `'none'` if no overlap

### Negotiation Rules

- Initiator's preference order is respected
- Both parties must support a protocol for it to be selected
- `'none'` is always available as a fallback
- Negotiation happens during the handshake (no extra round-trips)

### Example: Negotiation Outcome

```typescript
// Initiator supports: ['v2', 'v1', 'none']
// Responder supports: ['v1', 'none']
// Result: 'v1' (first match from initiator's list)

// Initiator supports: ['v2', 'none']
// Responder supports: ['v1', 'none']
// Result: 'none' (only common protocol)
```

## Lazy Loading Protocols

Load protocol providers on-demand:

```typescript
const broker = createBroker({
  name: 'lazy-broker',
  contract: myContract,
  settings: {
    security: {
      protocolLoader: async (version, platform) => {
        if (version === 'v2') {
          const { createProtocol } = await import(
            `@hyperfrontend/network-protocol/${platform}/v2`
          )
          return createProtocol(logger, 'key', 60)
        }
        throw new Error(`Unknown protocol: ${version}`)
      },
      defaultProtocol: 'v2',
    },
  },
})
```

## Migration Guide

### From Non-Secure to Secure

Existing code continues to work without modification:

```typescript
// Before (still works)
const broker = createBroker({
  name: 'my-broker',
  contract: myContract,
})

// After (with security)
const broker = createBroker({
  name: 'my-broker',
  contract: myContract,
  settings: {
    security: {
      protocols: { v2: provider },
      defaultProtocol: 'v2',
    },
  },
})
```

### Gradual Rollout

1. **Phase 1**: Add security config to broker, keep `defaultProtocol: 'none'`
2. **Phase 2**: Enable security for specific channels
3. **Phase 3**: Change `defaultProtocol` to `'v2'`

```typescript
// Phase 1: Security available but not default
const broker = createBroker({
  settings: {
    security: {
      protocols: { v2: provider },
      defaultProtocol: 'none', // Keep existing behavior
    },
  },
})

// Phase 2: Enable for specific channels
const secureChannel = broker.addChannel('payments', window, {
  security: { protocol: 'v2' },
})

// Phase 3: Make security default
// Change defaultProtocol: 'v2' in broker config
```

## Best Practices

### Key Management

- Use unique shared keys per environment (dev/staging/prod)
- Rotate shared keys periodically at the application level
- Store keys securely (environment variables, secrets manager)

### Performance

- V2 with key rotation adds minimal overhead
- Use `'none'` for high-frequency, non-sensitive messages
- Consider message batching for bulk operations

### Error Handling

- Always handle `security-error` events
- Implement retry logic for transient failures
- Log security errors for monitoring

### Testing

- Test with `'none'` protocol during development
- Test negotiation fallback scenarios
- Test error recovery paths

## Troubleshooting

### Channel Won't Connect

1. Check if both parties support compatible protocols
2. Verify shared keys match for v2
3. Check for security-error events

### Decryption Failures

1. Verify shared keys are identical
2. Check for clock skew between parties
3. Ensure message wasn't corrupted in transit

### Performance Issues

1. Consider reducing key rotation frequency
2. Check for excessive error retry loops
3. Profile the encryption pipeline

## API Reference

See the [NEXUS_PROTOCOL_ANALYSIS.md](/roadmap/NEXUS_PROTOCOL_ANALYSIS.md) for complete API documentation, including:

- Type definitions for all security interfaces
- Protocol negotiation algorithms
- Transport implementation details
- Event system specifications

