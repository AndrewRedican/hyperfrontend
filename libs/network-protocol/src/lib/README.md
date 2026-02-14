# Network Protocol - Library Core (`src/lib/`)

> This is the **primary documentation hub** for `@hyperfrontend/network-protocol`.

## Overview

The `lib/` directory contains all platform-agnostic code including:

- Interface definitions (`model.ts` files)
- Factory creators (dependency injection patterns)
- Validations and utilities
- Core business logic

Platform-specific implementations (`browser/` and `node/`) import from here and inject platform dependencies (crypto, transport).

## Module Index

| Module                 | Purpose                                   | README                                   |
| ---------------------- | ----------------------------------------- | ---------------------------------------- |
| [channel/](channel/)   | Bidirectional communication channels      | [channel/README.md](channel/README.md)   |
| [data/](data/)         | Message payload with schema generation    | [data/README.md](data/README.md)         |
| [packet/](packet/)     | Packet types and transformations          | [packet/README.md](packet/README.md)     |
| [protocol/](protocol/) | Protocol coordination (v1 implementation) | [protocol/README.md](protocol/README.md) |
| [queue/](queue/)       | FIFO message processing queues            | [queue/README.md](queue/README.md)       |
| [receiver/](receiver/) | Inbound message pipeline                  | [receiver/README.md](receiver/README.md) |
| [routing/](routing/)   | Topic-based message routing               | [routing/README.md](routing/README.md)   |
| [security/](security/) | Security suite interfaces                 | [security/README.md](security/README.md) |
| [sender/](sender/)     | Outbound message pipeline                 | [sender/README.md](sender/README.md)     |
| [topic/](topic/)       | Topic store management                    | [topic/README.md](topic/README.md)       |

## Architecture

For the complete architecture guide including composition diagrams and factory patterns, see:

- **[ARCHITECTURE.md](../../ARCHITECTURE.md)** - Comprehensive architecture documentation

## Platform Entry Points

This shared library is consumed by platform-specific entry points:

| Platform | Entry Point                   | README                                    |
| -------- | ----------------------------- | ----------------------------------------- |
| Browser  | [`src/browser/`](../browser/) | [browser/README.md](../browser/README.md) |
| Node.js  | [`src/node/`](../node/)       | [node/README.md](../node/README.md)       |

## Integration Tests

Integration tests live alongside platform implementations since they use real crypto:

| Platform | Test File                                                                                   | Description                  |
| -------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| Node.js  | [`node/v1/v1.integration.spec.ts`](../node/v1/v1.integration.spec.ts)                       | v1 protocol with Node crypto |
| Browser  | [`browser/v1/v1.integration.browser.spec.ts`](../browser/v1/v1.integration.browser.spec.ts) | v1 protocol with Web Crypto  |

Additional integration test placeholders in this directory (`*.integration.spec.ts`) are for:

- Testing shared factory logic with mocked platform dependencies
- Documenting expected API composition patterns

## Quick Links

- [Root README](../../README.md) - Package overview and installation
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Architecture guide
