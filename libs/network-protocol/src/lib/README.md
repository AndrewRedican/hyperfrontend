# Core Modules

This documentation covers the core modules of `@hyperfrontend/network-protocol`.

## Module Overview

| Module       | Purpose                                   |
| ------------ | ----------------------------------------- |
| **Channel**  | Bidirectional communication channels      |
| **Data**     | Message payload with schema generation    |
| **Packet**   | Packet types and transformations          |
| **Protocol** | Protocol coordination (v1 implementation) |
| **Queue**    | FIFO message processing queues            |
| **Receiver** | Inbound message pipeline                  |
| **Routing**  | Topic-based message routing               |
| **Security** | Security suite interfaces                 |
| **Sender**   | Outbound message pipeline                 |
| **Topic**    | Topic store management                    |

## Platform Support

The library provides platform-specific implementations with identical APIs:

| Platform | Import Path                                  |
| -------- | -------------------------------------------- |
| Browser  | `@hyperfrontend/network-protocol/browser/v1` |
| Node.js  | `@hyperfrontend/network-protocol/node/v1`    |

## Further Reading

- [Architecture Guide](../../ARCHITECTURE.md) - Complete architecture documentation
- [Main README](../../README.md) - Package overview and installation
