/**
 * Nx project.json configuration types.
 */
export interface ProjectJsonFixture {
  projectType?: 'library' | 'application'
  targets?: Record<string, object>
  tags?: string[]
  [key: string]: unknown
}

/**
 * npm package.json configuration.
 */
export interface PackageJsonFixture {
  name?: string
  version?: string
  exports?: Record<string, unknown> | string
  main?: string
  module?: string
  types?: string
  files?: string[]
  publishConfig?: object
  [key: string]: unknown
}

/**
 * Valid publishable library project.json.
 * Has both `build` and `publish` targets.
 */
export const PUBLISHABLE_LIBRARY_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'library',
  targets: {
    build: { executor: '@nx/js:tsc' },
    publish: { executor: '@nx/js:release-publish' },
  },
}

/**
 * Non-publishable library project.json.
 * Has `build` but no `publish` target.
 */
export const NON_PUBLISHABLE_LIBRARY_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'library',
  targets: {
    build: { executor: '@nx/js:tsc' },
  },
}

/**
 * Application project.json.
 * projectType is 'application', not 'library'.
 */
export const APPLICATION_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'application',
  targets: {
    build: { executor: '@nx/webpack:build' },
    serve: { executor: '@nx/webpack:dev-server' },
  },
}

/**
 * Library without build target.
 */
export const LIBRARY_NO_BUILD_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'library',
  targets: {},
}

/**
 * Minimal valid project.json (just projectType).
 */
export const MINIMAL_LIBRARY_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'library',
}

/**
 * E2E project project.json.
 */
export const E2E_PROJECT_JSON: ProjectJsonFixture = {
  projectType: 'application',
  targets: {
    e2e: { executor: '@nx/playwright:playwright' },
  },
  tags: ['type:e2e'],
}

/**
 * Valid publishable package.json with exports field.
 */
export const PUBLISHABLE_PACKAGE_JSON: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  exports: {
    '.': {
      import: './dist/index.js',
      require: './dist/index.cjs',
      types: './dist/index.d.ts',
    },
    './package.json': './package.json',
  },
  files: ['dist'],
}

/**
 * Package.json with ./package.json export.
 */
export const PACKAGE_JSON_WITH_PACKAGE_EXPORT: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  exports: {
    './package.json': './package.json',
  },
}

/**
 * Package.json missing ./package.json export.
 */
export const PACKAGE_JSON_WITHOUT_PACKAGE_EXPORT: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  exports: {
    '.': './dist/index.js',
  },
}

/**
 * Minimal package.json (name and version only).
 */
export const MINIMAL_PACKAGE_JSON: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
}

/**
 * Package.json with CommonJS main field.
 */
export const CJS_PACKAGE_JSON: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  main: './dist/index.cjs',
}

/**
 * Package.json with ESM module field.
 */
export const ESM_PACKAGE_JSON: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  module: './dist/index.js',
  type: 'module',
}

/**
 * Package.json with TypeScript extensions in exports (invalid).
 */
export const TS_EXPORTS_PACKAGE_JSON: PackageJsonFixture = {
  name: '@hyperfrontend/test-lib',
  version: '0.0.1',
  exports: {
    '.': './src/index.ts',
  },
}

/**
 * Tsconfig with paths for library imports.
 */
export const TSCONFIG_WITH_PATHS = {
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@hyperfrontend/*': ['libs/*/src/index.ts'],
    },
  },
}

/**
 * Minimal tsconfig.json.
 */
export const MINIMAL_TSCONFIG = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
  },
}

/**
 * Valid library README with required sections.
 */
export const VALID_LIB_README = `# @hyperfrontend/test-lib

A test library.

## Installation

\`\`\`bash
npm install @hyperfrontend/test-lib
\`\`\`

## Usage

\`\`\`typescript
import { foo } from '@hyperfrontend/test-lib'
\`\`\`

## API Reference

See [TypeDoc](https://hyperfrontend.dev/docs/test-lib).
`

/**
 * README missing required sections.
 */
export const INVALID_LIB_README = `# @hyperfrontend/test-lib

This README is missing required sections.
`

/**
 * Empty README.
 */
export const EMPTY_README = ''

/**
 * Valid TypeScript index file with exports.
 */
export const VALID_INDEX_TS = `export const foo = 'bar'
export function helper(): void {}
export type FooType = { foo: string }
`

/**
 * Valid barrel export file.
 */
export const VALID_BARREL_EXPORT = `export * from './foo'
export * from './bar'
export * from './baz'
`

/**
 * Creates a custom publishable library project.json.
 *
 * @param overrides - Properties to override
 * @returns ProjectJsonFixture
 */
export function createPublishableProjectJson(overrides?: Partial<ProjectJsonFixture>): ProjectJsonFixture {
  return {
    ...PUBLISHABLE_LIBRARY_PROJECT_JSON,
    ...overrides,
  }
}

/**
 * Creates a custom package.json.
 *
 * @param overrides - Properties to override
 * @returns PackageJsonFixture
 */
export function createPackageJson(overrides?: Partial<PackageJsonFixture>): PackageJsonFixture {
  return {
    ...PUBLISHABLE_PACKAGE_JSON,
    ...overrides,
  }
}

/**
 * Creates a package.json with a specific name.
 *
 * @param name - Package name to set in the fixture
 * @returns PackageJsonFixture
 */
export function createNamedPackageJson(name: string): PackageJsonFixture {
  return {
    ...PUBLISHABLE_PACKAGE_JSON,
    name,
  }
}
