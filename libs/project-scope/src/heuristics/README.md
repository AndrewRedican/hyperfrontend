# Heuristics Module

The `heuristics` module provides intelligent detection of project characteristics using multiple signals. It analyzes project structure, configuration files, dependencies, and code patterns to make accurate determinations about project type, frameworks, entry points, and dependency graphs.

## Capabilities

### Project Type Detection

Determine if a project is an application, library, e2e test suite, CLI tool, or plugin.

```typescript
import { detectProjectType } from '@hyperfrontend/project-scope'

const result = detectProjectType('./my-project')
console.log(result.type) // 'library' | 'application' | 'e2e' | 'tool' | 'plugin'
console.log(result.confidence) // 85
console.log(result.evidence) // [{ factor: 'exports', confidence: 20, description: '...' }]
```

#### Detection Factors

| Factor              | Signals                                 | Confidence Impact   |
| ------------------- | --------------------------------------- | ------------------- |
| Package name        | `-lib`, `-app`, `-e2e`, `-cli` suffixes | 15-30               |
| Exports field       | Has `exports`, `main`, or `module`      | +20 for library     |
| Bin field           | Has CLI executable definition           | +40 for tool        |
| Entry points        | `server.ts` vs `index.ts` patterns      | 20-30               |
| Directory structure | `public/`, `pages/`, `lib/`, `cypress/` | 10-20               |
| Framework presence  | Frontend/backend frameworks             | +20 for application |
| E2E frameworks      | Cypress, Playwright, Puppeteer          | +25 for e2e         |

### Framework Identification

Comprehensive framework detection with confidence scoring.

```typescript
import { identifyFrameworks } from '@hyperfrontend/project-scope'

const result = identifyFrameworks('./my-react-app')

console.log(result.summary) // 'React + Next.js with Jest'
console.log(result.primary?.name) // 'React'
console.log(result.frontend) // [{ id: 'react', name: 'React', ... }]
console.log(result.backend) // [{ id: 'express', name: 'Express', ... }]
console.log(result.metaFrameworks) // [{ id: 'nextjs', name: 'Next.js', ... }]
console.log(result.testing) // [{ id: 'jest', name: 'Jest', ... }]

// Stack summary for quick access
console.log(result.stack.frontend) // ['react', 'nextjs']
console.log(result.stack.testing) // ['jest']
console.log(result.stack.build) // ['webpack']
console.log(result.stack.linting) // ['eslint', 'prettier']
```

### Entry Point Discovery

Find application entry points from package.json and conventions.

```typescript
import { discoverEntryPoints } from '@hyperfrontend/project-scope'

const entryPoints = discoverEntryPoints('./my-app')

for (const entry of entryPoints) {
  console.log(`${entry.path} (${entry.type}) - ${entry.confidence}% confidence`)
}
// Output:
// src/index.ts (main) - 100% confidence
// src/cli.ts (cli) - 85% confidence
// src/server.ts (server) - 80% confidence
```

#### Entry Point Sources

| Source                | Priority | Examples                                       |
| --------------------- | -------- | ---------------------------------------------- |
| `package.json` fields | 100%     | `main`, `module`, `browser`, `bin`, `exports`  |
| Convention patterns   | 80-90%   | `src/index.ts`, `src/main.ts`, `src/server.ts` |
| Framework-specific    | 85%      | Next.js pages, Angular modules                 |

### Dependency Graph Analysis

Build internal dependency graphs from source code.

```typescript
import { buildDependencyGraph } from '@hyperfrontend/project-scope'

const graph = buildDependencyGraph('./my-lib')

console.log('Root files:', graph.roots) // Files not imported by anything
console.log('Leaf files:', graph.leaves) // Files that don't import anything
console.log('Total nodes:', graph.nodes.size)

// Examine dependencies
const node = graph.nodes.get('src/utils/helper.ts')
console.log('Depends on:', node?.dependencies) // ['src/utils/base.ts']
console.log('Used by:', node?.dependents) // ['src/index.ts', 'src/cli.ts']
```

#### Dependency Extraction

Supports multiple import/export patterns:

- ES imports: `import { x } from './module'`
- Dynamic imports: `import('./module')`
- CommonJS: `require('./module')`
- Re-exports: `export * from './module'`

### Package Dependencies

Analyze npm dependencies from package.json.

```typescript
import { getProjectDependencies } from '@hyperfrontend/project-scope'

const deps = getProjectDependencies('./my-project')

console.log('Runtime:', deps.runtime) // ['react', 'lodash']
console.log('Development:', deps.development) // ['typescript', 'jest']
console.log('Peer:', deps.peer) // ['react']
console.log('Total:', deps.total) // 25
```

## Caching

All detection functions use intelligent caching:

- **TTL**: 60 seconds (appropriate for active development)
- **Automatic invalidation**: Cache keys include all relevant options
- **Skip cache**: Pass `{ skipCache: true }` for fresh results

```typescript
// Force fresh detection
const result = detectProjectType('./project', { skipCache: true })
```

## Design Principles

1. **Multi-signal detection**: Never rely on a single indicator
2. **Confidence scoring**: All detections include confidence percentages
3. **Evidence tracking**: Understand why a detection was made
4. **Graceful degradation**: Always returns a result, even with low confidence
5. **Performance**: Aggressive caching with appropriate TTLs
