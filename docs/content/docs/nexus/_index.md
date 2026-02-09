---
title: Nexus
weight: 3
bookCollapseSection: true
---

# @hyperfrontend/nexus

Cross-window communication with contracts, lifecycle management, and security.

## Overview

Nexus implements a TCP-like connection protocol for secure cross-origin communication via the `postMessage` API. It provides a robust, type-safe mechanism for establishing, managing, and terminating bidirectional communication channels between browser contexts.

## Features

- **TCP-Like Three-Way Handshake**: SYN/SYN-ACK/ACK pattern for reliable connection establishment
- **Full Lifecycle Management**: Complete connection, disconnection, and cancellation flows
- **Process Tracking**: UUID-based tracking of all in-flight connection processes
- **Event-Driven Architecture**: Subscriber notifications for all lifecycle events
- **Security Policies**: Configurable origin filtering and custom security hooks
- **Contract Validation**: Schema-based validation of channel contracts
- **Transport Layer Security**: Optional end-to-end encryption via network-protocol integration

## Documentation

- [Security Integration](security-integration.md) - Encrypted channel communication

## Quick Links

- [Source Code](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)
- [Protocol Analysis](/roadmap/NEXUS_PROTOCOL_ANALYSIS.md)
- [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/README.md)
