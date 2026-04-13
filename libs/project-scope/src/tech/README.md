# Tech Module

The `tech` module provides comprehensive technology stack detection for JavaScript/TypeScript projects. It identifies frontend frameworks, backend frameworks, build tools, testing frameworks, type systems, linting tools, and legacy frameworks.

## Capabilities

### Detect All Technologies

Run all detectors at once for a complete technology stack analysis.

```typescript
import { detectAll } from '@hyperfrontend/project-scope'

const detections = detectAll('./my-project')

// Frontend frameworks (React, Vue, Angular, Svelte, etc.)
for (const fw of detections.frontendFrameworks) {
  console.log(`${fw.name} v${fw.version} (${fw.confidence}% confidence)`)
  if (fw.metaFrameworks) {
    console.log(
      '  Meta-frameworks:',
      fw.metaFrameworks.map((m) => m.name)
    )
  }
}

// Backend frameworks (Express, NestJS, Fastify, etc.)
console.log(
  'Backend:',
  detections.backendFrameworks.map((f) => f.name)
)

// Build tools (Webpack, Vite, esbuild, etc.)
console.log(
  'Build tools:',
  detections.buildTools.map((t) => t.name)
)

// Testing frameworks (Jest, Vitest, Cypress, etc.)
console.log(
  'Testing:',
  detections.testingFrameworks.map((t) => `${t.name} (${t.type})`)
)

// Type system (TypeScript, Flow)
console.log(
  'Types:',
  detections.typeSystem.map((t) => t.name)
)

// Linting (ESLint, Prettier, Biome)
console.log(
  'Linting:',
  detections.linting.map((t) => t.name)
)

// Legacy frameworks (jQuery, AngularJS, Backbone)
console.log(
  'Legacy:',
  detections.legacyFrameworks.map((t) => t.name)
)
```

### Frontend Framework Detection

```typescript
import { frameworkDetectors, reactDetector, vueDetector } from '@hyperfrontend/project-scope'

// Use individual detectors
const react = reactDetector('./my-app')
if (react) {
  console.log('React detected:', react.version)
  console.log('Meta-frameworks:', react.metaFrameworks) // Next.js, Gatsby, Remix
}

// All frontend detectors
for (const detector of frameworkDetectors) {
  const result = detector.detect('./my-app')
  if (result) {
    console.log(`${detector.name}: ${result.confidence}%`)
  }
}
```

#### Supported Frontend Frameworks

| Framework | Meta-frameworks        | Detection Sources                 |
| --------- | ---------------------- | --------------------------------- |
| React     | Next.js, Gatsby, Remix | `react`, `react-dom` packages     |
| Vue       | Nuxt                   | `vue` package, `.vue` files       |
| Angular   |                        | `@angular/core` package           |
| Svelte    | SvelteKit              | `svelte` package, `.svelte` files |
| Solid     |                        | `solid-js` package                |
| Qwik      |                        | `@builder.io/qwik` package        |
| Astro     |                        | `astro` package                   |

### Backend Framework Detection

```typescript
import { backendDetectors } from '@hyperfrontend/project-scope'

const detections = backendDetectors.map((d) => d.detect('./my-api')).filter(Boolean)

for (const detection of detections) {
  console.log(`${detection.name} (${detection.type})`) // 'Express (http-server)'
}
```

#### Supported Backend Frameworks

| Framework | Type        | Detection Sources      |
| --------- | ----------- | ---------------------- |
| Express   | http-server | `express` package      |
| NestJS    | framework   | `@nestjs/core` package |
| Fastify   | http-server | `fastify` package      |
| Koa       | http-server | `koa` package          |
| Hono      | http-server | `hono` package         |

### Build Tool Detection

```typescript
import { buildToolDetectors } from '@hyperfrontend/project-scope'

for (const detector of buildToolDetectors) {
  const result = detector.detect('./my-project')
  if (result) {
    console.log(`${result.name}: ${result.configPath}`)
  }
}
```

#### Supported Build Tools

| Tool    | Detection Sources                             |
| ------- | --------------------------------------------- |
| Webpack | `webpack` package, `webpack.config.*` files   |
| Vite    | `vite` package, `vite.config.*` files         |
| esbuild | `esbuild` package                             |
| Rollup  | `rollup` package, `rollup.config.*` files     |
| Parcel  | `parcel` package                              |
| SWC     | `@swc/core` package                           |
| Babel   | `@babel/core` package, `babel.config.*` files |

### Testing Framework Detection

```typescript
import { testingDetectors } from '@hyperfrontend/project-scope'

const tests = testingDetectors.map((d) => d.detect('./my-project')).filter(Boolean)

for (const test of tests) {
  console.log(`${test.name} (${test.type})`) // 'Jest (unit)', 'Cypress (e2e)'
}
```

#### Supported Testing Frameworks

| Framework  | Type | Detection Sources                         |
| ---------- | ---- | ----------------------------------------- |
| Jest       | unit | `jest` package, `jest.config.*` files     |
| Vitest     | unit | `vitest` package, `vitest.config.*` files |
| Mocha      | unit | `mocha` package                           |
| Cypress    | e2e  | `cypress` package, `cypress/` directory   |
| Playwright | e2e  | `@playwright/test` package                |

### Monorepo Tool Detection

```typescript
import { monorepoDetectors } from '@hyperfrontend/project-scope'

for (const detector of monorepoDetectors) {
  const result = detector.detect('./')
  if (result) {
    console.log(`Monorepo: ${result.name}`)
  }
}
```

#### Supported Monorepo Tools

| Tool            | Detection Sources                  |
| --------------- | ---------------------------------- |
| NX              | `nx.json`, `@nx/workspace` package |
| Turborepo       | `turbo.json`, `turbo` package      |
| Lerna           | `lerna.json`, `lerna` package      |
| Rush            | `rush.json`                        |
| PNPM Workspaces | `pnpm-workspace.yaml`              |

## Detection Result Structure

All detections follow a common structure:

```typescript
interface BaseDetection {
  /** Unique identifier (lowercase) */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version (from package.json) */
  version?: string
  /** Confidence score 0-100 */
  confidence: number
  /** How the detection was made */
  detectedFrom: DetectionSource[]
}

interface DetectionSource {
  type: 'package.json' | 'config-file' | 'directory' | 'file-pattern'
  field?: string // For package.json
  path?: string // For files
}
```

## Caching

Detection results are cached for 60 seconds:

```typescript
// Use cached results (default)
const result1 = detectAll('./my-project')

// Force fresh detection
const result2 = detectAll('./my-project', { skipCache: true })
```

## Confidence Scoring

Confidence scores reflect detection reliability:

| Range  | Meaning                                          |
| ------ | ------------------------------------------------ |
| 90-100 | Very high confidence (explicit package + config) |
| 70-89  | High confidence (package dependency present)     |
| 50-69  | Medium confidence (config file or patterns)      |
| 30-49  | Low confidence (indirect signals)                |
| 0-29   | Very low confidence (heuristics only)            |
