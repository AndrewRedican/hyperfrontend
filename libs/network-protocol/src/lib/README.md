# Core Modules

This documentation covers the core modules of [`@hyperfrontend/network-protocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/).

## Module Overview

| Module                             | Purpose                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| [**Channel**](channel/README.md)   | Bidirectional channels binding one protocol instance to one session |
| [**Data**](data/README.md)         | Message payload with schema generation                              |
| [**Packet**](packet/README.md)     | Plaintext packets, wire frames, and drop reports                    |
| [**Protocol**](protocol/README.md) | Session protocol: hello exchange, key schedule, seal and open       |
| [**Queue**](queue/README.md)       | FIFO seal and open queues                                           |
| [**Receiver**](receiver/README.md) | Inbound pipeline: frames in, opened packets out                     |
| [**Routing**](routing/README.md)   | Topic-based message routing                                         |
| [**Security**](security/README.md) | Session types, hello outcome, and protocol error codes              |
| [**Sender**](sender/README.md)     | Outbound pipeline: packets in, sealed frames out                    |
| [**Topic**](topic/README.md)       | Topic store management                                              |

## Platform Support

The library provides platform-specific implementations with identical APIs. Each protocol entry exports [`createProtocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-createProtocol): [`v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-V3) keys a session from an ephemeral P-256 agreement alone, and [`v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-V4) mixes a pre-shared key into the same schedule. Both platforms produce identical frames and interoperate.

| Platform | Protocol entries                                                                                                                                                                                                                                     | Pipeline entries                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browser  | [`@hyperfrontend/network-protocol/browser/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v3/), [`@hyperfrontend/network-protocol/browser/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/) | `.../browser/channel`, `.../browser/data`, `.../browser/packet`, `.../browser/sender`, `.../browser/receiver` |
| Node.js  | [`@hyperfrontend/network-protocol/node/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v3/), [`@hyperfrontend/network-protocol/node/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/)             | `.../node/channel`, `.../node/data`, `.../node/packet`, `.../node/sender`, `.../node/receiver`                |

The platform-neutral entries [`/queue`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/queue/), [`/routing`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/routing/), [`/security`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/), and [`/topic`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/topic/) are shared by both.

## Further Reading

- [Architecture Guide](../../ARCHITECTURE.md) - Complete architecture documentation
- [Main README](../../README.md) - Package overview and installation
- [Browser Platform](../browser/README.md) and [Node.js Platform](../node/README.md) - Platform entry points
