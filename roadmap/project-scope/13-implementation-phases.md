# Implementation Phases

> **Document**: 13-implementation-phases.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Prioritized implementation roadmap

---

## Overview

Implementation is organized into sequential phases. Each phase builds on the previous and produces testable, usable functionality. No timeframes or effort estimates are included—this is a purely technical dependency ordering.

---

## Phase 1: Foundation

**Goal**: Core infrastructure required by all other modules.

### Tasks

1. **Initialize library structure**
   - Create `libs/project-scope/` directory
   - Set up `project.json`, `package.json`, `tsconfig.json`
   - Configure Jest for testing
   - Add to workspace path mappings in `tsconfig.base.json`

2. **Implement Layer 1: Core Utilities**
   - `core/fs/read.ts` - `readFileContent`, `readTextFile`, `readBinaryFile`, `readJsonFile`
   - `core/fs/write.ts` - `writeFileContent`, `writeTextFile`, `writeBinaryFile`, `writeJsonFile`
   - `core/fs/stat.ts` - `getFileInfo`, `exists`, `isFile`, `isDirectory`
   - `core/fs/directory.ts` - `listDirectory`, `createDirectory`, `removeDirectory`
   - `core/path/index.ts` - `normalizePath`, `resolvePath`, `relativePath`, `getSegments`
   - `core/platform/index.ts` - `detectPlatform`, `isCaseSensitiveFs`
   - `core/encoding/index.ts` - `detectEncoding`, `toUtf8`

3. **Unit tests for Layer 1**
   - 100% coverage for all core utilities
   - Edge cases: symlinks, permissions, encoding

### Deliverables

- ✓ Library skeleton with build configuration
- ✓ All Layer 1 modules implemented and tested
- ✓ Passes `nx build project-scope` and `nx test project-scope`

---

## Phase 2: Virtual File System

**Goal**: Transaction-aware file system abstraction.

### Tasks

1. **Implement VFS types**
   - `vfs/types.ts` - `Tree`, `FileChange`, `Mode`, `WriteOptions` interfaces

2. **Implement FsTree**
   - `vfs/fs-tree.ts` - Main Tree implementation
   - Methods: `read`, `write`, `delete`, `exists`, `isFile`, `isDirectory`, `children`, `rename`, `listChanges`
   - Buffer changes in memory until commit

3. **Implement commit functionality**
   - `vfs/commit.ts` - `commitChanges()`, dry-run support

4. **Implement diff generation**
   - `vfs/diff.ts` - `generateDiff()`, unified diff output

5. **Integration tests for VFS**
   - Create/update/delete workflows
   - Change isolation verification
   - Commit behavior

### Deliverables

- ✓ Complete VFS implementation
- ✓ Transaction semantics working
- ✓ Dry-run capability functional

---

## Phase 3: Project Utilities

**Goal**: Generic project understanding capabilities.

### Tasks

1. **Implement traversal module**
   - `project/traversal/walk.ts` - `walkDirectory`, `walkTree`
   - `project/traversal/find.ts` - `findFiles`, `findDirectories`
   - Respect ignore patterns, depth limits

2. **Implement config detection**
   - `project/config/patterns.ts` - `CONFIG_PATTERNS` constant
   - `project/config/detect.ts` - `detectConfigs`
   - `project/config/parse.ts` - `parseConfig` (JSON, YAML, JS, TS)

3. **Implement package.json utilities**
   - `project/package/read.ts` - `readPackageJson`, `readPackageJsonIfExists`
   - `project/package/dependencies.ts` - dependency extraction

4. **Implement root detection**
   - `project/root/find.ts` - `findProjectRoot`, `findWorkspaceRoot`
   - Support for various monorepo structures

5. **Tests for all Layer 2 modules**

### Deliverables

- ✓ Directory traversal working
- ✓ Config file detection across formats
- ✓ Package.json parsing
- ✓ Project/workspace root detection

---

## Phase 4: Technology Detection

**Goal**: Identify build tools, frameworks, and tech stack.

### Tasks

1. **Implement detector infrastructure**
   - `tech/types.ts` - Detector interfaces
   - `tech/registry.ts` - Detector registration and discovery

2. **Implement build tool detectors**
   - `tech/build/webpack.ts`
   - `tech/build/vite.ts`
   - `tech/build/rollup.ts`
   - `tech/build/esbuild.ts`
   - `tech/build/parcel.ts`
   - `tech/build/swc.ts`

3. **Implement monorepo tool detectors**
   - `tech/monorepo/nx.ts`
   - `tech/monorepo/turbo.ts`
   - `tech/monorepo/lerna.ts`
   - `tech/monorepo/pnpm.ts`
   - `tech/monorepo/rush.ts`
   - `tech/monorepo/npm.ts`

4. **Implement frontend framework detectors**
   - `tech/frontend/react.ts`
   - `tech/frontend/vue.ts`
   - `tech/frontend/angular.ts`
   - `tech/frontend/svelte.ts`
   - `tech/frontend/nextjs.ts`
   - `tech/frontend/nuxt.ts`
   - `tech/frontend/remix.ts`

5. **Implement backend framework detectors**
   - `tech/backend/express.ts`
   - `tech/backend/nest.ts`
   - `tech/backend/fastify.ts`
   - `tech/backend/hono.ts`

6. **Implement testing framework detectors**
   - `tech/testing/jest.ts`
   - `tech/testing/vitest.ts`
   - `tech/testing/cypress.ts`
   - `tech/testing/playwright.ts`

7. **Implement type system detectors**
   - `tech/types/typescript.ts`
   - `tech/types/flow.ts`

8. **Implement `detectAll` aggregator**

9. **Tests for all detectors**
   - Test with fixture projects
   - Confidence scoring validation

### Deliverables

- ✓ All major frameworks/tools detectable
- ✓ Confidence scoring working
- ✓ Version detection where applicable

---

## Phase 5: Heuristics Engine

**Goal**: Intelligent inference and analysis.

### Tasks

1. **Implement project type detection**
   - `heuristics/project-type/detect.ts` - `detectProjectType`
   - Multi-factor scoring algorithm
   - Evidence collection

2. **Implement framework identification**
   - `heuristics/framework/identify.ts` - `identifyFrameworks`
   - Stack summary generation

3. **Implement entry point discovery**
   - `heuristics/entry-points/discover.ts` - `discoverEntryPoints`
   - Convention-based discovery
   - Framework-specific patterns

4. **Implement dependency graph**
   - `heuristics/dependencies/graph.ts` - `buildDependencyGraph`
   - `heuristics/dependencies/cycles.ts` - `findCircularDependencies`
   - Source file import analysis

5. **Implement configuration inference**
   - `heuristics/inference/infer.ts` - `inferConfiguration`
   - Missing config suggestions
   - Best practice recommendations

6. **Implement caching layer**
   - `heuristics/cache.ts` - Analysis result caching

7. **Integration tests for heuristics**
   - Full project analysis workflows
   - Various project structure tests

### Deliverables

- ✓ Project type classification
- ✓ Framework stack analysis
- ✓ Entry point detection
- ✓ Dependency graph building
- ✓ Config inference

---

## Phase 6: NX Integration

**Goal**: Seamless NX workspace support.

### Tasks

1. **Implement NX detection**
   - `nx/detect.ts` - `isNxWorkspace`, `findNxWorkspaceRoot`, `getNxWorkspaceInfo`

2. **Implement @nx/devkit loader**
   - `nx/devkit-loader.ts` - Runtime detection, lazy loading

3. **Implement NX config parsing**
   - `nx/project-config.ts` - `readProjectJson`, `discoverNxProjects`
   - `nx/types.ts` - NX type definitions

4. **Implement compatibility layer**
   - `nx/compat.ts` - Tree wrapping, JSON utilities
   - API alignment with @nx/devkit

5. **Implement fallback implementations**
   - `nx/json-compat.ts` - `readJson`, `writeJson`, `updateJson`
   - `nx/graph-compat.ts` - `getProjectGraph`

6. **Tests for NX integration**
   - With @nx/devkit available
   - Without @nx/devkit (fallback)

### Deliverables

- ✓ NX workspace auto-detection
- ✓ Optional @nx/devkit integration
- ✓ Standalone mode fully functional

---

## Phase 7: Main API

**Goal**: Public API surface.

### Tasks

1. **Implement main analysis function**
   - `analyze.ts` - `analyzeProject()`
   - Orchestrates all layers

2. **Define and export type definitions**
   - `models/index.ts` - All public types

3. **Create public API barrel export**
   - `index.ts` - Public API surface
   - Careful about what's exported

4. **API documentation**
   - JSDoc comments on all exports
   - README with usage examples

5. **API tests**
   - Integration tests for `analyzeProject`
   - Type tests

### Deliverables

- ✓ Clean public API
- ✓ TypeScript declarations
- ✓ Documentation

---

## Phase 8: CLI

**Goal**: Command-line interface.

### Tasks

1. **Implement CLI framework**
   - `cli/index.ts` - Entry point
   - `cli/types.ts` - Command interfaces

2. **Implement `analyze` command**
   - `cli/commands/analyze.ts`
   - Text/JSON/YAML output formatters

3. **Implement `tree` command**
   - `cli/commands/tree.ts`
   - Directory tree visualization

4. **Implement `config` command**
   - `cli/commands/config.ts`
   - Configuration inspection

5. **Implement `deps` command**
   - `cli/commands/deps.ts`
   - Dependency analysis

6. **Implement `validate` command**
   - `cli/commands/validate.ts`
   - Project validation

7. **Implement output formatters**
   - `cli/formatters/` - Text, JSON, YAML
   - Color support

8. **CLI tests**
   - Command parsing tests
   - Output format tests

### Deliverables

- ✓ Fully functional CLI
- ✓ All commands implemented
- ✓ Output formats working

---

## Phase 9: E2E Testing

**Goal**: End-to-end validation.

### Tasks

1. **Create E2E test project**
   - `apps/package-e2e/project-scope/`
   - Configure Jest

2. **Implement CJS tests**
   - `src/cjs.spec.ts`
   - Verify CommonJS imports work

3. **Implement ESM tests**
   - `src/esm.spec.ts`
   - Verify ES module imports work

4. **Create test fixtures**
   - Various project structures
   - Real-world-like configurations

5. **CI integration**
   - Add to affected pipeline
   - Coverage reporting

### Deliverables

- ✓ CJS import verified
- ✓ ESM import verified
- ✓ Full workflow tests

---

## Phase 10: Polish & Release

**Goal**: Production readiness.

### Tasks

1. **Documentation**
   - Complete README.md
   - API reference (typedoc)
   - Usage examples

2. **Performance optimization**
   - Profile hot paths
   - Optimize large project handling
   - Caching refinement

3. **Bundle optimization**
   - Size analysis
   - Tree-shaking verification
   - Chunk optimization

4. **Error messages**
   - User-friendly error messages
   - Helpful suggestions

5. **Release preparation**
   - CHANGELOG.md
   - Version bump
   - npm publish preparation

### Deliverables

- ✓ Complete documentation
- ✓ Optimized bundle
- ✓ Ready for v0.1.0 release

---

## Phase Dependencies

```
Phase 1: Foundation
    ↓
Phase 2: VFS ←────────────────────────────┐
    ↓                                     │
Phase 3: Project Utilities                │
    ↓                                     │
Phase 4: Tech Detection                   │
    ↓                                     │
Phase 5: Heuristics                       │
    ↓                                     │
Phase 6: NX Integration ─────────────────→│
    ↓                                     │
Phase 7: Main API ←───────────────────────┘
    ↓
Phase 8: CLI
    ↓
Phase 9: E2E Testing
    ↓
Phase 10: Polish & Release
```

---

## Implementation Checklist

### Phase 1

- [ ] Library structure initialized
- [ ] Build configuration working
- [ ] Core FS utilities implemented
- [ ] Core path utilities implemented
- [ ] Platform detection implemented
- [ ] Encoding utilities implemented
- [ ] All Phase 1 tests passing

### Phase 2

- [ ] Tree interface defined
- [ ] FsTree implemented
- [ ] commitChanges implemented
- [ ] Diff generation implemented
- [ ] All Phase 2 tests passing

### Phase 3

- [ ] Directory traversal implemented
- [ ] Config detection implemented
- [ ] Package.json utilities implemented
- [ ] Root detection implemented
- [ ] All Phase 3 tests passing

### Phase 4

- [ ] Detector infrastructure complete
- [ ] Build tool detectors complete
- [ ] Monorepo tool detectors complete
- [ ] Frontend framework detectors complete
- [ ] Backend framework detectors complete
- [ ] Testing framework detectors complete
- [ ] Type system detectors complete
- [ ] All Phase 4 tests passing

### Phase 5

- [ ] Project type detection implemented
- [ ] Framework identification implemented
- [ ] Entry point discovery implemented
- [ ] Dependency graph implemented
- [ ] Configuration inference implemented
- [ ] Caching implemented
- [ ] All Phase 5 tests passing

### Phase 6

- [ ] NX detection implemented
- [ ] @nx/devkit loader implemented
- [ ] NX config parsing implemented
- [ ] Compatibility layer implemented
- [ ] Fallback implementations complete
- [ ] All Phase 6 tests passing

### Phase 7

- [ ] analyzeProject implemented
- [ ] All types exported
- [ ] Public API finalized
- [ ] JSDoc complete
- [ ] All Phase 7 tests passing

### Phase 8

- [ ] CLI entry point working
- [ ] analyze command complete
- [ ] tree command complete
- [ ] config command complete
- [ ] deps command complete
- [ ] validate command complete
- [ ] All Phase 8 tests passing

### Phase 9

- [ ] E2E test project created
- [ ] CJS tests passing
- [ ] ESM tests passing
- [ ] CI integration complete

### Phase 10

- [ ] README complete
- [ ] API docs generated
- [ ] Performance acceptable
- [ ] Bundle size acceptable
- [ ] CHANGELOG written
- [ ] Ready for release

---

## Related Documents

- [Architecture](./01-architecture.md)
- [API Design](./02-api-design.md)
- [Testing Strategy](./09-testing-strategy.md)
- [Build Configuration](./11-build-configuration.md)
