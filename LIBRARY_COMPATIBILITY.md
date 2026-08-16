# Library Compatibility Matrix

> **Can I Use** style reference for @hyperfrontend libraries

Last updated: July 31, 2026

---

## Platform Support Overview

| Library                                 | Browser | Node.js | Web Worker | CDN Bundle |
| --------------------------------------- | :-----: | :-----: | :--------: | :--------: |
| `@hyperfrontend/data-utils`             |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/function-utils`         |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/string-utils`           |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/time-utils`             |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/immutable-api-utils`    |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/json-utils`             |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/list-utils`             |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/random-generator-utils` |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/ui-utils`               |   ✅    |   ⚠️¹   |     ✅     |     ✅     |
| `@hyperfrontend/logging`                |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/state-machine`          |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/cryptography`           |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/network-protocol`       |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/nexus`                  |   ✅    |   ✅    |     ✅     |     ✅     |
| `@hyperfrontend/features`               |   ✅    |   ✅³   |    ⚠️³     |    ✅³     |
| `@hyperfrontend/questions`              |   ❌²   |   ✅    |    ❌²     |    ❌²     |
| `@hyperfrontend/project-scope`          |   ❌²   |   ✅    |    ❌²     |    ❌²     |
| `@hyperfrontend/versioning`             |   ❌²   |   ✅    |    ❌²     |    ❌²     |
| `@hyperfrontend/builder`                |   ❌²   |   ✅    |    ❌²     |    ❌²     |

**Notes:**

1. `ui-utils`: Some DOM utilities require browser APIs; check individual exports
2. Build-time or CLI-time Node.js toolkits; not intended for browser, Web Worker, or CDN runtimes
3. `features`: Support is per entry point, not per package. `/host` and `/hostee` are browser
   runtimes and ship IIFE/UMD bundles for CDN use; `/cli`, `/server`, and `/generators` are Node-only.
   The root entry (types, `defineConfig`, contract validation) is DOM-free and runs anywhere,
   including a Web Worker; `/host` and `/hostee` drive `window` directly, so neither does.

---

## Output Formats

All libraries ship with multiple output formats:

| Format | File Extension | Use Case                                         | Tree-Shakeable |
| ------ | -------------- | ------------------------------------------------ | :------------: |
| ESM    | `.esm.js`      | Modern bundlers, native `<script type="module">` |       ✅       |
| CJS    | `.cjs.js`      | Node.js, legacy bundlers (Webpack 4, etc.)       |       ❌       |
| IIFE   | `.iife.js`     | Browser `<script>` tags, CDN                     |       ❌       |
| UMD    | `.umd.js`      | Universal (AMD, CommonJS, global)                |       ❌       |

---

## CDN Usage

### unpkg

```html
<!-- Latest version -->
<script src="https://unpkg.com/@hyperfrontend/data-utils"></script>

<!-- Specific version -->
<script src="https://unpkg.com/@hyperfrontend/data-utils@0.0.1"></script>

<!-- Explicit bundle path (required for multi-bundle packages) -->
<script src="https://unpkg.com/@hyperfrontend/network-protocol/bundle/v2/index.umd.min.js"></script>
```

### jsDelivr

```html
<!-- Latest version -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/data-utils"></script>

<!-- Specific version -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/data-utils@0.0.1"></script>

<!-- Explicit bundle path -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/network-protocol/bundle/v2/index.umd.min.js"></script>
```

### Global Variable Names

| Library                  | Global Name                      |
| ------------------------ | -------------------------------- |
| `data-utils`             | `HyperfrontendDataUtils`         |
| `function-utils`         | `HyperfrontendFunctionUtils`     |
| `string-utils`           | `HyperfrontendStringUtils`       |
| `time-utils`             | `HyperfrontendTimeUtils`         |
| `immutable-api-utils`    | `HyperfrontendImmutableApiUtils` |
| `json-utils`             | `HyperfrontendJsonUtils`         |
| `list-utils`             | `HyperfrontendListUtils`         |
| `random-generator-utils` | `HyperfrontendRandomGenerator`   |
| `ui-utils`               | `HyperfrontendUIUtils`           |
| `logging`                | `HyperfrontendLogging`           |
| `state-machine`          | `HyperfrontendStateMachine`      |
| `cryptography`           | `HyperfrontendCryptography`      |
| `network-protocol` (v1)  | `HyperfrontendNetworkProtocolV1` |
| `network-protocol` (v2)  | `HyperfrontendNetworkProtocolV2` |
| `nexus`                  | `HyperfrontendNexus`             |
| `features` (`/host`)     | `HyperfrontendFeaturesHost`      |
| `features` (`/hostee`)   | `HyperfrontendFeaturesHostee`    |

---

## Platform-Specific Exports

Some libraries have separate entry points for browser and Node.js environments:

### `@hyperfrontend/cryptography`

```typescript
// Auto-resolved based on environment (bundler conditions)
import { createHash } from '@hyperfrontend/cryptography'

// Explicit platform import
import { createHash } from '@hyperfrontend/cryptography/browser'
import { createHash } from '@hyperfrontend/cryptography/node'
```

### `@hyperfrontend/string-utils`

```typescript
// Auto-resolved based on environment
import { utf8StringToUint8Array } from '@hyperfrontend/string-utils'

// Explicit platform import
import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'
import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
```

### `@hyperfrontend/network-protocol`

```typescript
// Browser — choose protocol version explicitly
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'

// Node.js
import { createProtocol } from '@hyperfrontend/network-protocol/node/v2'

// Shared types and utilities (isomorphic)
import type { Message } from '@hyperfrontend/network-protocol/lib/types'
```

### `@hyperfrontend/features`

Entry points split by role rather than by platform. Import only the surface you need; each is an
independent subpath, so a feature app never pulls in the host SDK or the CLI.

```typescript
// Browser — the host embedding a feature
import { createShell } from '@hyperfrontend/features/host'

// Browser — the feature app being embedded
import { createFeature } from '@hyperfrontend/features/hostee'

// Node.js — build tooling
import { runBuild } from '@hyperfrontend/features/cli'
import { generateShell } from '@hyperfrontend/features/generators'
import { startDevServer } from '@hyperfrontend/features/server'

// Shared types, contract validation, defineConfig
import { defineConfig } from '@hyperfrontend/features'
```

The package also ships an `hf` bin and an optional Nx adapter at `@hyperfrontend/features/nx/*`
(a `feature` generator plus `build` and `serve` executors), neither of which the core imports.

---

## Dependency Graph

### Zero Dependencies (Leaf Nodes)

These libraries have no internal dependencies:

- `function-utils`
- `immutable-api-utils`

### Core Utilities (Depend Only on immutable-api-utils)

| Library        | Depends On          |
| -------------- | ------------------- |
| `data-utils`   | immutable-api-utils |
| `string-utils` | immutable-api-utils |
| `time-utils`   | immutable-api-utils |
| `json-utils`   | immutable-api-utils |

### Internal Dependencies

| Library                  | Depends On                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `list-utils`             | data-utils, immutable-api-utils                                                              |
| `random-generator-utils` | data-utils, immutable-api-utils                                                              |
| `logging`                | data-utils, function-utils, immutable-api-utils                                              |
| `state-machine`          | data-utils, immutable-api-utils                                                              |
| `ui-utils`               | data-utils, function-utils, list-utils, logging, random-generator-utils, immutable-api-utils |
| `cryptography`           | data-utils, random-generator-utils, string-utils, time-utils, immutable-api-utils            |

### High-Level Libraries

| Library            | Key Dependencies                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `network-protocol` | cryptography, logging, json-utils, list-utils, random-generator-utils, string-utils, time-utils                   |
| `nexus`            | network-protocol, logging, json-utils, random-generator-utils                                                     |
| `builder`          | logging, project-scope, immutable-api-utils, versioning                                                           |
| `features`         | nexus, network-protocol, builder, project-scope, questions, versioning, json-utils, ui-utils, immutable-api-utils |

---

## Engine Requirements

All libraries specify minimum Node.js and npm versions in their `package.json` `engines` field.

### Version Requirements

| Library                                 |  Node.js   |    npm    | Notes                                             |
| --------------------------------------- | :--------: | :-------: | ------------------------------------------------- |
| `@hyperfrontend/data-utils`             | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/function-utils`         | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/time-utils`             | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/immutable-api-utils`    | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/json-utils`             | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/list-utils`             | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/random-generator-utils` | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/logging`                | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/state-machine`          | `>=18.0.0` | `>=8.0.0` | Platform-agnostic                                 |
| `@hyperfrontend/string-utils`           | `>=18.0.0` | `>=8.0.0` | Isomorphic (browser/node entries)                 |
| `@hyperfrontend/ui-utils`               | `>=18.0.0` | `>=8.0.0` | Browser runtime, Node for dev/test                |
| `@hyperfrontend/cryptography`           | `>=18.0.0` | `>=8.0.0` | Node 19+ recommended for `/node` entry ¹          |
| `@hyperfrontend/network-protocol`       | `>=18.0.0` | `>=8.0.0` | Node 19+ recommended for `/node/*` entries ¹      |
| `@hyperfrontend/nexus`                  | `>=18.0.0` | `>=8.0.0` | Browser runtime, Node for dev/test                |
| `@hyperfrontend/features`               | `>=18.0.0` | `>=8.0.0` | Browser SDK plus Node CLI, dev server, generators |
| `@hyperfrontend/questions`              | `>=18.0.0` | `>=8.0.0` | Node CLI prompts                                  |
| `@hyperfrontend/project-scope`          | `>=18.0.0` | `>=8.0.0` | Node project analysis + VFS                       |
| `@hyperfrontend/versioning`             | `>=18.0.0` | `>=8.0.0` | Node release toolkit (CLI + library)              |
| `@hyperfrontend/builder`                | `>=18.0.0` | `>=8.0.0` | Node build tool (CLI + library)                   |

¹ The `/node` entry points use `webcrypto.subtle` which was experimental in Node 18.x and became stable in Node 19.0.0. For production use with Node.js, version 19+ is recommended.

### Why Node 18+?

- **ES2022 target**: All libraries compile to ES2022, which requires Node 18+ for full feature support
- **ESM support**: Native ES modules with `exports` field conditions
- **npm 8+**: Required for workspace dependencies and modern `package.json` features

---

## Web Worker Compatibility

Every browser bundle except `@hyperfrontend/features` uses `globalThis.crypto` instead of `window.crypto`, so it runs unchanged in:

- Dedicated Workers
- Shared Workers
- Service Workers
- Cloudflare Workers
- Deno
- Bun

The `features` `/host` and `/hostee` bundles are the exception: they drive `window` and DOM APIs directly, so they are browser-only (see note 3 above).

### Example: Using in a Web Worker

```javascript
// worker.js
importScripts('https://unpkg.com/@hyperfrontend/cryptography')

const { createHash } = HyperfrontendCryptography

self.onmessage = async (e) => {
  const hash = await createHash(e.data)
  self.postMessage(hash)
}
```

---

## TypeScript Support

All libraries ship with TypeScript declarations (`.d.ts` files) alongside JavaScript outputs.

| Feature           | Supported |
| ----------------- | :-------: |
| Type declarations |    ✅     |
| Source maps       |    ✅     |
| Strict mode       |    ✅     |
| ESM types         |    ✅     |

### tsconfig.json Recommendations

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

---

## Version Compatibility

| @hyperfrontend Version | Minimum TypeScript | Minimum Node.js | ES Target |
| :--------------------: | :----------------: | :-------------: | :-------: |
|         0.0.1          |        5.0         |     18.0.0      |  ES2022   |

---

## Library Dependency Diagram

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TB
    subgraph ZERO["🌱 Zero Dependencies"]
        direction LR
        function-utils
        immutable-api-utils
    end

    subgraph CORE["📦 Core Utilities"]
        direction LR
        data-utils
        string-utils
        time-utils
        json-utils
    end

    subgraph UTILS["🔧 Utilities"]
        direction LR
        list-utils
        random-generator-utils
        logging
        ui-utils
    end

    subgraph STATE["📊 State"]
        state-machine
    end

    subgraph CRYPTO["🔐 Crypto"]
        cryptography
    end

    subgraph NET["🌐 Networking"]
        direction LR
        network-protocol
        nexus
    end

    subgraph SDK["🧩 Feature SDK"]
        features
    end

    %% Core utilities depend on immutable-api-utils
    data-utils --> immutable-api-utils
    string-utils --> immutable-api-utils
    time-utils --> immutable-api-utils
    json-utils --> immutable-api-utils

    %% Utilities layer
    list-utils --> data-utils
    random-generator-utils --> data-utils
    logging --> data-utils
    logging --> function-utils
    state-machine --> data-utils
    ui-utils --> data-utils
    ui-utils --> function-utils
    ui-utils --> list-utils
    ui-utils --> logging
    ui-utils --> random-generator-utils

    %% Crypto layer
    cryptography --> data-utils
    cryptography --> random-generator-utils
    cryptography --> string-utils
    cryptography --> time-utils

    %% Network layer
    network-protocol --> cryptography
    network-protocol --> logging
    network-protocol --> json-utils
    network-protocol --> list-utils
    network-protocol --> random-generator-utils
    network-protocol --> string-utils
    network-protocol --> time-utils

    nexus --> network-protocol
    nexus --> logging
    nexus --> json-utils
    nexus --> random-generator-utils

    %% Feature SDK layer
    features --> nexus
    features --> network-protocol
    features --> json-utils
    features --> ui-utils
```

### Platform & Format Support

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart LR
    subgraph PLATFORMS["🖥️ Platforms"]
        direction TB
        Browser["Browser ✅"]
        NodeJS["Node.js ✅"]
        Workers["Web Workers ✅"]
    end

    subgraph FORMATS["📦 Output Formats"]
        direction TB
        ESM["ESM ✅"]
        CJS["CJS ✅"]
        IIFE["IIFE ✅"]
        UMD["UMD ✅"]
    end

    subgraph CDN["🌍 CDN"]
        direction TB
        unpkg["unpkg"]
        jsdelivr["jsDelivr"]
    end

    PLATFORMS --> FORMATS
    FORMATS --> CDN
```
