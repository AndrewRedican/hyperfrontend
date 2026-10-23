# Library Compatibility Matrix

> Generated from each package's `project.json` and `package.json`. Regenerate it with `npx nx lint:all` rather than editing it by hand.

## Platform Support

| Library | Node.js | Browser | Web Worker | CDN Bundle |
| --- | --- | --- | --- | --- |
| `@hyperfrontend/builder` | ✅ | ❌ | ❌ | ❌ |
| `@hyperfrontend/cryptography` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/data-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/features` | ✅ | ✅ | ⚠️ | ✅ |
| `@hyperfrontend/function-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/immutable-api-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/json-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/linter` | ✅ | ❌ | ❌ | ❌ |
| `@hyperfrontend/list-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/network-protocol` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/nexus` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/project-scope` | ✅ | ❌ | ❌ | ❌ |
| `@hyperfrontend/questions` | ✅ | ❌ | ❌ | ❌ |
| `@hyperfrontend/random-generator-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/state-machine` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/string-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/testing` | ✅ | ❌ | ❌ | ❌ |
| `@hyperfrontend/time-utils` | ✅ | ✅ | ✅ | ✅ |
| `@hyperfrontend/ui-utils` | ⚠️ | ✅ | ✅ | ✅ |
| `@hyperfrontend/versioning` | ✅ | ❌ | ❌ | ❌ |

Legend: ✅ full support, ⚠️ partial support, ❌ no support, ❓ nothing declared. CDN Bundle marks the packages whose build produces an IIFE or UMD bundle.

**Notes**

- `@hyperfrontend/builder`: Node.js 18 needs `--experimental-global-webcrypto` only to import `/bundle/rollup/worker` directly; `hf-build` passes it to the worker it spawns.
- `@hyperfrontend/cryptography`: `/browser` reads `globalThis.crypto` at first use; on Node.js that needs 19+ or 18 with `--experimental-global-webcrypto`.
- `@hyperfrontend/features`: Support is per entry point: `/host` and `/hostee` are browser runtimes, `/cli`, `/server`, and `/generators` are Node-only, and the root entry is DOM-free and runs anywhere. TypeScript `feature.config.*` and `*.contract.*` files need Node.js 23.6+ (22.6+ with `--experimental-strip-types`); JSON and JavaScript files load on every supported Node.js.
- `@hyperfrontend/immutable-api-utils`: `built-in-copy/websocket` loads without a `WebSocket` global (Node.js before 22); only construction throws there.
- `@hyperfrontend/linter`: Needs Node.js 24 or later: configurations are TypeScript modules loaded through Node's own type stripping.
- `@hyperfrontend/project-scope`: `/cli` parses arguments with `util.parseArgs`, so it needs Node.js 18.3+; every other entry runs on 18.0.
- `@hyperfrontend/testing`: Needs Node.js 22.18 or later: the preload installs synchronous module hooks and loads TypeScript specs through Node's own type stripping, neither of which older releases provide.
- `@hyperfrontend/ui-utils`: Some utilities require browser APIs; check individual exports.

## Output Formats

| Library | ESM | CJS | IIFE | UMD | Global name |
| --- | --- | --- | --- | --- | --- |
| `@hyperfrontend/builder` | ✅ | ✅ | ❌ | ❌ | - |
| `@hyperfrontend/cryptography` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendCryptography` |
| `@hyperfrontend/data-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendDataUtils` |
| `@hyperfrontend/features` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendFeaturesHost`, `HyperfrontendFeaturesHostee`, `HyperfrontendFeaturesDebugUi` |
| `@hyperfrontend/function-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendFunctionUtils` |
| `@hyperfrontend/immutable-api-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendImmutableApiUtils` |
| `@hyperfrontend/json-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendJsonUtils` |
| `@hyperfrontend/linter` | ✅ | ✅ | ❌ | ❌ | - |
| `@hyperfrontend/list-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendListUtils` |
| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendLogging` |
| `@hyperfrontend/network-protocol` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendNetworkProtocolV3`, `HyperfrontendNetworkProtocolV4` |
| `@hyperfrontend/nexus` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendNexus` |
| `@hyperfrontend/project-scope` | ✅ | ✅ | ❌ | ❌ | - |
| `@hyperfrontend/questions` | ✅ | ✅ | ❌ | ❌ | - |
| `@hyperfrontend/random-generator-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendRandomGenerator` |
| `@hyperfrontend/state-machine` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendStateMachine` |
| `@hyperfrontend/string-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendStringUtils` |
| `@hyperfrontend/testing` | ✅ | ✅ | ❌ | ❌ | - |
| `@hyperfrontend/time-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendTimeUtils` |
| `@hyperfrontend/ui-utils` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendUIUtils` |
| `@hyperfrontend/versioning` | ✅ | ✅ | ❌ | ❌ | - |

## Engine Requirements

| Library | Node.js | npm |
| --- | --- | --- |
| `@hyperfrontend/builder` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/cryptography` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/data-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/features` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/function-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/immutable-api-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/json-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/linter` | `>=24.0.0` | `>=8.0.0` |
| `@hyperfrontend/list-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/logging` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/network-protocol` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/nexus` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/project-scope` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/questions` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/random-generator-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/state-machine` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/string-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/testing` | `>=22.18.0` | `>=8.0.0` |
| `@hyperfrontend/time-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/ui-utils` | `>=18.0.0` | `>=8.0.0` |
| `@hyperfrontend/versioning` | `>=18.0.0` | `>=8.0.0` |

## Dependency Graph

| Library | Depends on |
| --- | --- |
| `@hyperfrontend/builder` | `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/logging`, `@hyperfrontend/project-scope`, `@hyperfrontend/versioning` |
| `@hyperfrontend/cryptography` | `@hyperfrontend/data-utils`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/random-generator-utils`, `@hyperfrontend/string-utils`, `@hyperfrontend/time-utils` |
| `@hyperfrontend/data-utils` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/features` | `@hyperfrontend/builder`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/network-protocol`, `@hyperfrontend/nexus`, `@hyperfrontend/project-scope`, `@hyperfrontend/questions`, `@hyperfrontend/ui-utils`, `@hyperfrontend/versioning` |
| `@hyperfrontend/function-utils` | - |
| `@hyperfrontend/immutable-api-utils` | - |
| `@hyperfrontend/json-utils` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/linter` | `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/versioning` |
| `@hyperfrontend/list-utils` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/logging` | `@hyperfrontend/data-utils`, `@hyperfrontend/function-utils`, `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/network-protocol` | `@hyperfrontend/cryptography`, `@hyperfrontend/data-utils`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/logging`, `@hyperfrontend/random-generator-utils`, `@hyperfrontend/string-utils`, `@hyperfrontend/time-utils` |
| `@hyperfrontend/nexus` | `@hyperfrontend/data-utils`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/logging`, `@hyperfrontend/network-protocol` (peer), `@hyperfrontend/random-generator-utils` |
| `@hyperfrontend/project-scope` | `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/logging` |
| `@hyperfrontend/questions` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/random-generator-utils` | `@hyperfrontend/data-utils`, `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/state-machine` | `@hyperfrontend/data-utils`, `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/string-utils` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/testing` | - |
| `@hyperfrontend/time-utils` | `@hyperfrontend/immutable-api-utils` |
| `@hyperfrontend/ui-utils` | `@hyperfrontend/data-utils`, `@hyperfrontend/function-utils`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/list-utils`, `@hyperfrontend/logging`, `@hyperfrontend/random-generator-utils` |
| `@hyperfrontend/versioning` | `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/logging`, `@hyperfrontend/project-scope`, `@hyperfrontend/questions` |

Solid edges are runtime dependencies; dotted edges are peer dependencies.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TB
    builder["builder"]
    cryptography["cryptography"]
    data_utils["data-utils"]
    features["features"]
    function_utils["function-utils"]
    immutable_api_utils["immutable-api-utils"]
    json_utils["json-utils"]
    linter["linter"]
    list_utils["list-utils"]
    logging["logging"]
    network_protocol["network-protocol"]
    nexus["nexus"]
    project_scope["project-scope"]
    questions["questions"]
    random_generator_utils["random-generator-utils"]
    state_machine["state-machine"]
    string_utils["string-utils"]
    testing["testing"]
    time_utils["time-utils"]
    ui_utils["ui-utils"]
    versioning["versioning"]
    builder --> immutable_api_utils
    builder --> logging
    builder --> project_scope
    builder --> versioning
    cryptography --> data_utils
    cryptography --> immutable_api_utils
    cryptography --> random_generator_utils
    cryptography --> string_utils
    cryptography --> time_utils
    data_utils --> immutable_api_utils
    features --> builder
    features --> immutable_api_utils
    features --> json_utils
    features --> network_protocol
    features --> nexus
    features --> project_scope
    features --> questions
    features --> ui_utils
    features --> versioning
    json_utils --> immutable_api_utils
    linter --> immutable_api_utils
    linter --> json_utils
    linter --> versioning
    list_utils --> immutable_api_utils
    logging --> data_utils
    logging --> function_utils
    logging --> immutable_api_utils
    network_protocol --> cryptography
    network_protocol --> data_utils
    network_protocol --> immutable_api_utils
    network_protocol --> json_utils
    network_protocol --> logging
    network_protocol --> random_generator_utils
    network_protocol --> string_utils
    network_protocol --> time_utils
    nexus --> data_utils
    nexus --> immutable_api_utils
    nexus --> json_utils
    nexus --> logging
    nexus -.-> network_protocol
    nexus --> random_generator_utils
    project_scope --> immutable_api_utils
    project_scope --> logging
    questions --> immutable_api_utils
    random_generator_utils --> data_utils
    random_generator_utils --> immutable_api_utils
    state_machine --> data_utils
    state_machine --> immutable_api_utils
    string_utils --> immutable_api_utils
    time_utils --> immutable_api_utils
    ui_utils --> data_utils
    ui_utils --> function_utils
    ui_utils --> immutable_api_utils
    ui_utils --> list_utils
    ui_utils --> logging
    ui_utils --> random_generator_utils
    versioning --> immutable_api_utils
    versioning --> json_utils
    versioning --> logging
    versioning --> project_scope
    versioning --> questions
```

## Published Versions

| Library | Version |
| --- | --- |
| `@hyperfrontend/builder` | `0.5.2` |
| `@hyperfrontend/cryptography` | `1.1.1` |
| `@hyperfrontend/data-utils` | `1.0.1` |
| `@hyperfrontend/features` | `0.11.5` |
| `@hyperfrontend/function-utils` | `1.0.1` |
| `@hyperfrontend/immutable-api-utils` | `1.0.2` |
| `@hyperfrontend/json-utils` | `1.1.0` |
| `@hyperfrontend/linter` | `0.0.0` |
| `@hyperfrontend/list-utils` | `0.1.1` |
| `@hyperfrontend/logging` | `1.0.1` |
| `@hyperfrontend/network-protocol` | `2.0.1` |
| `@hyperfrontend/nexus` | `3.0.1` |
| `@hyperfrontend/project-scope` | `0.3.0` |
| `@hyperfrontend/questions` | `0.3.1` |
| `@hyperfrontend/random-generator-utils` | `0.2.1` |
| `@hyperfrontend/state-machine` | `0.2.1` |
| `@hyperfrontend/string-utils` | `1.0.1` |
| `@hyperfrontend/testing` | `0.1.0` |
| `@hyperfrontend/time-utils` | `1.0.1` |
| `@hyperfrontend/ui-utils` | `0.0.9` |
| `@hyperfrontend/versioning` | `0.9.2` |
