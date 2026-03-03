# Layer 3: Tech Stack Utilities

> **Document**: 05-layers-tech-stack.md
> **Library**: `@hyperfrontend/project-scope`
> **Layer**: Technology-Specific Operations

---

## Overview

Layer 3 provides utilities organized by technology stack, tool, or purpose. Each module handles detection, configuration parsing, and tooling-specific operations for its domain.

---

## Design Principles

1. **Organized by Purpose**: Group related tools together
2. **Lazy Loading**: Modules loaded on demand
3. **Detection Before Parsing**: Verify tool presence before parsing
4. **Graceful Degradation**: Handle missing/invalid configs gracefully

---

## Module Organization

```
tech/
├── index.ts                 # Main exports
├── build/                   # Build tools
│   ├── index.ts
│   ├── webpack.ts
│   ├── rollup.ts
│   ├── vite.ts
│   ├── esbuild.ts
│   ├── babel.ts
│   ├── swc.ts
│   └── parcel.ts
├── monorepo/               # Monorepo tools
│   ├── index.ts
│   ├── nx.ts
│   ├── turborepo.ts
│   ├── lerna.ts
│   ├── rush.ts
│   └── workspaces.ts
├── frontend/               # Frontend frameworks
│   ├── index.ts
│   ├── react.ts
│   ├── angular.ts
│   ├── vue.ts
│   ├── svelte.ts
│   ├── solid.ts
│   ├── qwik.ts
│   └── astro.ts
├── backend/                # Backend frameworks
│   ├── index.ts
│   ├── express.ts
│   ├── nest.ts
│   ├── fastify.ts
│   └── koa.ts
├── testing/                # Testing frameworks
│   ├── index.ts
│   ├── jest.ts
│   ├── vitest.ts
│   ├── mocha.ts
│   ├── cypress.ts
│   └── playwright.ts
├── types/                  # Type systems
│   ├── index.ts
│   ├── typescript.ts
│   ├── flow.ts
│   └── jsdoc.ts
├── linting/                # Linting tools
│   ├── index.ts
│   ├── eslint.ts
│   └── prettier.ts
└── legacy/                 # Legacy frameworks
    ├── index.ts
    ├── backbone.ts
    ├── ember.ts
    ├── meteor.ts
    └── jquery.ts
```

---

## Module: `tech/build`

### Build Tool Detection Interface

```typescript
// tech/build/index.ts
export interface BuildToolDetector {
  /** Tool identifier */
  id: BuildToolId
  /** Human-readable name */
  name: string
  /** Check if tool is present */
  detect(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null
  /** Parse configuration if present */
  parseConfig?(configPath: string): BuildToolConfig
}

export interface BuildToolDetection {
  id: BuildToolId
  name: string
  version?: string
  configPath?: string
  confidence: number // 0-100
  detectedFrom: DetectionSource[]
}

export type DetectionSource =
  | { type: 'package.json'; field: string }
  | { type: 'config-file'; path: string }
  | { type: 'lockfile'; name: string }
  | { type: 'directory'; path: string }

export interface BuildToolConfig {
  raw?: Record<string, unknown>
  entry?: string | string[]
  output?: string
  plugins?: string[]
  // Tool-specific fields
  [key: string]: unknown
}

// Registry of all build tool detectors
export const buildToolDetectors: BuildToolDetector[] = []

// Export individual detectors
export { webpackDetector } from './webpack'
export { rollupDetector } from './rollup'
export { viteDetector } from './vite'
export { esbuildDetector } from './esbuild'
export { babelDetector } from './babel'
export { swcDetector } from './swc'
export { parcelDetector } from './parcel'

/**
 * Detect all build tools in a project.
 */
export function detectBuildTools(projectPath: string, packageJson?: PackageJson): BuildToolDetection[] {
  const results: BuildToolDetection[] = []

  for (const detector of buildToolDetectors) {
    const detection = detector.detect(projectPath, packageJson)
    if (detection) {
      results.push(detection)
    }
  }

  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence)
}
```

### Webpack Detection

```typescript
// tech/build/webpack.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildToolDetector, BuildToolDetection, PackageJson } from './index'

const WEBPACK_CONFIG_PATTERNS = [
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'webpack.config.babel.js',
]

export const webpackDetector: BuildToolDetector = {
  id: 'webpack',
  name: 'Webpack',

  detect(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    // Check package.json dependencies
    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    if (deps['webpack']) {
      confidence += 50
      version = deps['webpack'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.webpack' })
    }

    // Check for config files
    for (const pattern of WEBPACK_CONFIG_PATTERNS) {
      const fullPath = join(projectPath, pattern)
      if (existsSync(fullPath)) {
        confidence += 40
        configPath = pattern
        sources.push({ type: 'config-file', path: pattern })
        break
      }
    }

    // Check for webpack-cli
    if (deps['webpack-cli']) {
      confidence += 10
      sources.push({ type: 'package.json', field: 'dependencies.webpack-cli' })
    }

    // Check scripts for webpack commands
    const scripts = packageJson?.scripts ?? {}
    for (const [name, command] of Object.entries(scripts)) {
      if (command?.includes('webpack')) {
        confidence = Math.min(confidence + 5, 100)
        sources.push({ type: 'package.json', field: `scripts.${name}` })
      }
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'webpack',
      name: 'Webpack',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

### Vite Detection

```typescript
// tech/build/vite.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildToolDetector, BuildToolDetection, PackageJson } from './index'

const VITE_CONFIG_PATTERNS = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']

export const viteDetector: BuildToolDetector = {
  id: 'vite',
  name: 'Vite',

  detect(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // Primary: vite package
    if (deps['vite']) {
      confidence += 60
      version = deps['vite'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.vite' })
    }

    // Config file
    for (const pattern of VITE_CONFIG_PATTERNS) {
      const fullPath = join(projectPath, pattern)
      if (existsSync(fullPath)) {
        confidence += 35
        configPath = pattern
        sources.push({ type: 'config-file', path: pattern })
        break
      }
    }

    // Vitest also indicates Vite ecosystem
    if (deps['vitest']) {
      confidence += 10
      sources.push({ type: 'package.json', field: 'dependencies.vitest' })
    }

    // Vite plugins
    const vitePlugins = Object.keys(deps).filter((d) => d.startsWith('vite-plugin-') || d.startsWith('@vitejs/'))
    if (vitePlugins.length > 0) {
      confidence += 10
      sources.push({ type: 'package.json', field: 'dependencies (vite plugins)' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'vite',
      name: 'Vite',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

---

## Module: `tech/monorepo`

### NX Detection

```typescript
// tech/monorepo/nx.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageJsonIfExists } from '../../project/package'
import { parseJsonConfig } from '../../project/config'
import type { MonorepoDetector, MonorepoDetection, NxWorkspaceInfo } from './index'

export const nxDetector: MonorepoDetector = {
  id: 'nx',
  name: 'NX',

  detect(workspacePath: string): MonorepoDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let version: string | undefined

    // Check for nx.json (definitive marker)
    const nxJsonPath = join(workspacePath, 'nx.json')
    if (existsSync(nxJsonPath)) {
      confidence += 70
      sources.push({ type: 'config-file', path: 'nx.json' })
    }

    // Check for nx package
    const rootPkg = readPackageJsonIfExists(workspacePath)
    const deps = {
      ...rootPkg?.dependencies,
      ...rootPkg?.devDependencies,
    }

    if (deps['nx']) {
      confidence += 20
      version = deps['nx'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.nx' })
    }

    // Check for project.json files (NX project marker)
    const hasProjectJson = existsSync(join(workspacePath, 'apps')) || existsSync(join(workspacePath, 'libs'))
    if (hasProjectJson) {
      confidence += 10
      sources.push({ type: 'directory', path: 'apps/ or libs/' })
    }

    // Check for @nx/* packages
    const nxPackages = Object.keys(deps).filter((d) => d.startsWith('@nx/'))
    if (nxPackages.length > 0) {
      confidence += 10
      sources.push({ type: 'package.json', field: '@nx/* packages' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'nx',
      name: 'NX',
      version,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },

  getWorkspaceInfo(workspacePath: string): NxWorkspaceInfo | null {
    const nxJsonPath = join(workspacePath, 'nx.json')
    if (!existsSync(nxJsonPath)) {
      return null
    }

    try {
      const nxJson = parseJsonConfig(nxJsonPath, undefined, 'nx')
      const data = nxJson.data ?? {}

      return {
        workspaceLayout: {
          appsDir: (data.workspaceLayout as Record<string, string>)?.appsDir ?? 'apps',
          libsDir: (data.workspaceLayout as Record<string, string>)?.libsDir ?? 'libs',
        },
        npmScope: data.npmScope as string | undefined,
        plugins:
          ((data.plugins as unknown[])
            ?.map((p) => (typeof p === 'string' ? p : (p as Record<string, string>)?.plugin))
            .filter(Boolean) as string[]) ?? [],
        targetDefaults: data.targetDefaults as Record<string, unknown> | undefined,
      }
    } catch {
      return null
    }
  },
}

export interface NxWorkspaceInfo {
  workspaceLayout: {
    appsDir: string
    libsDir: string
  }
  npmScope?: string
  plugins: string[]
  targetDefaults?: Record<string, unknown>
}
```

### TurboRepo Detection

```typescript
// tech/monorepo/turborepo.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { MonorepoDetector, MonorepoDetection } from './index'

export const turboRepoDetector: MonorepoDetector = {
  id: 'turborepo',
  name: 'TurboRepo',

  detect(workspacePath: string): MonorepoDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let version: string | undefined

    // Check for turbo.json
    const turboJsonPath = join(workspacePath, 'turbo.json')
    if (existsSync(turboJsonPath)) {
      confidence += 80
      sources.push({ type: 'config-file', path: 'turbo.json' })
    }

    // Check package.json for turbo
    const rootPkg = readPackageJsonIfExists(workspacePath)
    const deps = {
      ...rootPkg?.dependencies,
      ...rootPkg?.devDependencies,
    }

    if (deps['turbo']) {
      confidence += 15
      version = deps['turbo'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.turbo' })
    }

    // Check scripts
    const scripts = rootPkg?.scripts ?? {}
    if (Object.values(scripts).some((s) => s?.includes('turbo'))) {
      confidence += 5
      sources.push({ type: 'package.json', field: 'scripts (turbo commands)' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'turborepo',
      name: 'TurboRepo',
      version,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

---

## Module: `tech/frontend`

### React Detection

```typescript
// tech/frontend/react.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FrameworkDetector, FrameworkDetection, PackageJson } from './index'

const REACT_META_FRAMEWORKS = ['next', 'gatsby', 'remix', 'create-react-app']

export const reactDetector: FrameworkDetector = {
  id: 'react',
  name: 'React',
  category: 'frontend',

  detect(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let version: string | undefined
    const metaFrameworks: FrameworkDetection[] = []

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // React package
    if (deps['react']) {
      confidence += 60
      version = deps['react'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.react' })
    }

    // React DOM (web)
    if (deps['react-dom']) {
      confidence += 20
      sources.push({ type: 'package.json', field: 'dependencies.react-dom' })
    }

    // React Native
    if (deps['react-native']) {
      confidence += 20
      sources.push({ type: 'package.json', field: 'dependencies.react-native' })
    }

    // Check for JSX/TSX files (would require AST check)
    // For now, check common file patterns
    const hasJsxFiles =
      existsSync(join(projectPath, 'src', 'App.tsx')) ||
      existsSync(join(projectPath, 'src', 'App.jsx')) ||
      existsSync(join(projectPath, 'src', 'index.tsx'))
    if (hasJsxFiles) {
      confidence += 10
      sources.push({ type: 'directory', path: 'src/*.tsx' })
    }

    // Check for meta-frameworks
    if (deps['next']) {
      metaFrameworks.push({
        id: 'nextjs',
        name: 'Next.js',
        category: 'frontend',
        version: deps['next'].replace(/^[\^~]/, ''),
        confidence: 90,
        detectedFrom: [{ type: 'package.json', field: 'dependencies.next' }],
      })
    }

    if (deps['gatsby']) {
      metaFrameworks.push({
        id: 'gatsby',
        name: 'Gatsby',
        category: 'frontend',
        version: deps['gatsby'].replace(/^[\^~]/, ''),
        confidence: 90,
        detectedFrom: [{ type: 'package.json', field: 'dependencies.gatsby' }],
      })
    }

    if (deps['@remix-run/react'] || deps['remix']) {
      metaFrameworks.push({
        id: 'remix',
        name: 'Remix',
        category: 'frontend',
        confidence: 90,
        detectedFrom: [{ type: 'package.json', field: 'dependencies.remix' }],
      })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'react',
      name: 'React',
      category: 'frontend',
      version,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
      metaFrameworks: metaFrameworks.length > 0 ? metaFrameworks : undefined,
    }
  },
}
```

### Vue Detection

```typescript
// tech/frontend/vue.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FrameworkDetector, FrameworkDetection, PackageJson } from './index'

export const vueDetector: FrameworkDetector = {
  id: 'vue',
  name: 'Vue',
  category: 'frontend',

  detect(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let version: string | undefined
    const metaFrameworks: FrameworkDetection[] = []

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // Vue package
    if (deps['vue']) {
      confidence += 70
      version = deps['vue'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.vue' })
    }

    // Vue CLI
    if (deps['@vue/cli-service']) {
      confidence += 20
      sources.push({ type: 'package.json', field: 'dependencies.@vue/cli-service' })
    }

    // Check for .vue files
    const hasVueFiles = existsSync(join(projectPath, 'src', 'App.vue')) || existsSync(join(projectPath, 'src', 'main.vue'))
    if (hasVueFiles) {
      confidence += 10
      sources.push({ type: 'directory', path: 'src/*.vue' })
    }

    // Nuxt detection
    if (deps['nuxt'] || deps['nuxt3']) {
      metaFrameworks.push({
        id: 'nuxt',
        name: 'Nuxt',
        category: 'frontend',
        version: deps['nuxt']?.replace(/^[\^~]/, '') ?? deps['nuxt3']?.replace(/^[\^~]/, ''),
        confidence: 90,
        detectedFrom: [{ type: 'package.json', field: 'dependencies.nuxt' }],
      })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'vue',
      name: 'Vue',
      category: 'frontend',
      version,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
      metaFrameworks: metaFrameworks.length > 0 ? metaFrameworks : undefined,
    }
  },
}
```

### Angular Detection

```typescript
// tech/frontend/angular.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FrameworkDetector, FrameworkDetection, PackageJson } from './index'

export const angularDetector: FrameworkDetector = {
  id: 'angular',
  name: 'Angular',
  category: 'frontend',

  detect(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // Angular core
    if (deps['@angular/core']) {
      confidence += 70
      version = deps['@angular/core'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.@angular/core' })
    }

    // Angular CLI
    if (deps['@angular/cli']) {
      confidence += 15
      sources.push({ type: 'package.json', field: 'dependencies.@angular/cli' })
    }

    // angular.json config
    if (existsSync(join(projectPath, 'angular.json'))) {
      confidence += 15
      sources.push({ type: 'config-file', path: 'angular.json' })
    }

    // Legacy AngularJS detection
    if (deps['angular'] && !deps['@angular/core']) {
      return {
        id: 'angularjs',
        name: 'AngularJS (Legacy)',
        category: 'frontend',
        version: deps['angular'].replace(/^[\^~]/, ''),
        confidence: 80,
        detectedFrom: [{ type: 'package.json', field: 'dependencies.angular' }],
      }
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'angular',
      name: 'Angular',
      category: 'frontend',
      version,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

---

## Module: `tech/testing`

### Jest Detection

```typescript
// tech/testing/jest.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TestingFrameworkDetector, TestingFrameworkDetection, PackageJson } from './index'

const JEST_CONFIG_PATTERNS = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.json']

export const jestDetector: TestingFrameworkDetector = {
  id: 'jest',
  name: 'Jest',
  testType: 'unit',

  detect(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // Jest package
    if (deps['jest']) {
      confidence += 60
      version = deps['jest'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.jest' })
    }

    // Config file
    for (const pattern of JEST_CONFIG_PATTERNS) {
      const fullPath = join(projectPath, pattern)
      if (existsSync(fullPath)) {
        confidence += 30
        configPath = pattern
        sources.push({ type: 'config-file', path: pattern })
        break
      }
    }

    // jest field in package.json
    if (packageJson && 'jest' in packageJson) {
      confidence += 20
      sources.push({ type: 'package.json', field: 'jest' })
    }

    // Test script with jest
    const testScript = packageJson?.scripts?.test ?? ''
    if (testScript.includes('jest')) {
      confidence += 10
      sources.push({ type: 'package.json', field: 'scripts.test' })
    }

    // @types/jest
    if (deps['@types/jest']) {
      confidence += 5
      sources.push({ type: 'package.json', field: 'dependencies.@types/jest' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'jest',
      name: 'Jest',
      testType: 'unit',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

### Vitest Detection

```typescript
// tech/testing/vitest.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TestingFrameworkDetector, TestingFrameworkDetection, PackageJson } from './index'

export const vitestDetector: TestingFrameworkDetector = {
  id: 'vitest',
  name: 'Vitest',
  testType: 'unit',

  detect(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    if (deps['vitest']) {
      confidence += 70
      version = deps['vitest'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.vitest' })
    }

    // Config files
    const configPatterns = ['vitest.config.js', 'vitest.config.ts']
    for (const pattern of configPatterns) {
      if (existsSync(join(projectPath, pattern))) {
        confidence += 25
        configPath = pattern
        sources.push({ type: 'config-file', path: pattern })
        break
      }
    }

    // Often configured in vite.config
    if (!configPath && (existsSync(join(projectPath, 'vite.config.ts')) || existsSync(join(projectPath, 'vite.config.js')))) {
      confidence += 5
      sources.push({ type: 'config-file', path: 'vite.config.*' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'vitest',
      name: 'Vitest',
      testType: 'unit',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

### Cypress Detection

```typescript
// tech/testing/cypress.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TestingFrameworkDetector, TestingFrameworkDetection, PackageJson } from './index'

export const cypressDetector: TestingFrameworkDetector = {
  id: 'cypress',
  name: 'Cypress',
  testType: 'e2e',

  detect(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    if (deps['cypress']) {
      confidence += 60
      version = deps['cypress'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.cypress' })
    }

    // Config file
    const configPatterns = ['cypress.config.js', 'cypress.config.ts', 'cypress.json']
    for (const pattern of configPatterns) {
      if (existsSync(join(projectPath, pattern))) {
        confidence += 30
        configPath = pattern
        sources.push({ type: 'config-file', path: pattern })
        break
      }
    }

    // Cypress directory
    if (existsSync(join(projectPath, 'cypress'))) {
      confidence += 10
      sources.push({ type: 'directory', path: 'cypress/' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'cypress',
      name: 'Cypress',
      testType: 'e2e',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

---

## Module: `tech/types`

### TypeScript Detection

```typescript
// tech/types/typescript.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TypeSystemDetector, TypeSystemDetection, PackageJson } from './index'

export const typescriptDetector: TypeSystemDetector = {
  id: 'typescript',
  name: 'TypeScript',

  detect(projectPath: string, packageJson?: PackageJson): TypeSystemDetection | null {
    const sources: DetectionSource[] = []
    let confidence = 0
    let configPath: string | undefined
    let version: string | undefined

    const deps = {
      ...packageJson?.dependencies,
      ...packageJson?.devDependencies,
    }

    // TypeScript package
    if (deps['typescript']) {
      confidence += 50
      version = deps['typescript'].replace(/^[\^~]/, '')
      sources.push({ type: 'package.json', field: 'dependencies.typescript' })
    }

    // tsconfig.json
    if (existsSync(join(projectPath, 'tsconfig.json'))) {
      confidence += 40
      configPath = 'tsconfig.json'
      sources.push({ type: 'config-file', path: 'tsconfig.json' })
    }

    // @types packages
    const typePackages = Object.keys(deps).filter((d) => d.startsWith('@types/'))
    if (typePackages.length > 0) {
      confidence += 10
      sources.push({ type: 'package.json', field: '@types/* packages' })
    }

    if (confidence === 0) {
      return null
    }

    return {
      id: 'typescript',
      name: 'TypeScript',
      version,
      configPath,
      confidence: Math.min(confidence, 100),
      detectedFrom: sources,
    }
  },
}
```

---

## All Detectors Registry

```typescript
// tech/index.ts
import { buildToolDetectors } from './build'
import { monorepoDetectors } from './monorepo'
import { frameworkDetectors } from './frontend'
import { backendDetectors } from './backend'
import { testingDetectors } from './testing'
import { typeSystemDetectors } from './types'
import { lintingDetectors } from './linting'
import { legacyDetectors } from './legacy'

/**
 * All available detectors.
 */
export const allDetectors = {
  build: buildToolDetectors,
  monorepo: monorepoDetectors,
  frontend: frameworkDetectors,
  backend: backendDetectors,
  testing: testingDetectors,
  types: typeSystemDetectors,
  linting: lintingDetectors,
  legacy: legacyDetectors,
}

/**
 * Run all detectors on a project.
 */
export function detectAll(projectPath: string, packageJson?: PackageJson): AllDetections {
  return {
    buildTools: buildToolDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    monorepo: monorepoDetectors.map((d) => d.detect(projectPath)).filter(Boolean),
    frontendFrameworks: frameworkDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    backendFrameworks: backendDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    testingFrameworks: testingDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    typeSystem: typeSystemDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    linting: lintingDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
    legacy: legacyDetectors.map((d) => d.detect(projectPath, packageJson)).filter(Boolean),
  }
}
```

---

## Related Documents

- [Layer 2: Project Utilities](./04-layers-project-utilities.md)
- [Layer 4: Heuristics Engine](./06-layers-heuristics.md)
- [NX Integration](./08-nx-integration.md)
