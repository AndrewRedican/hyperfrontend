import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule from './no-barrel-star-export'

type TestOptions = readonly []
type MessageIds = 'noStarExport' | 'noStarExportTypeOnly'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/**
 * Creates a temporary publishable library project.
 *
 * @param config - Configuration for the temporary project.
 * @param config.exports - Optional exports field for package.json.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { exports?: Record<string, string | Record<string, string>> }): string {
  const files: Record<string, string> = {}

  files['project.json'] = JSON.stringify(
    {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    null,
    2
  )

  const packageJsonExports: Record<string, string | Record<string, string>> = {
    '.': './src/index.js',
    './package.json': './package.json',
    ...config.exports,
  }

  files['package.json'] = JSON.stringify(
    {
      name: 'test-lib',
      exports: packageJsonExports,
    },
    null,
    2
  )

  files['src/index.ts'] = 'export {}\n'

  const workspace = manager.create({ files })
  return workspace.root
}

/**
 * Creates a non-publishable library project.
 *
 * @returns The path to the temporary project directory.
 */
function createNonPublishableProject(): string {
  const files: Record<string, string> = {
    'project.json': JSON.stringify(
      {
        projectType: 'library',
        targets: { build: {} },
      },
      null,
      2
    ),
    'package.json': JSON.stringify({ name: 'internal-lib' }, null, 2),
    'src/index.ts': 'export {}\n',
  }

  const workspace = manager.create({ files })
  return workspace.root
}

/**
 * Creates a publishable project with project.json but NO package.json.
 *
 * @returns The path to the temporary project directory.
 */
function createProjectWithoutPackageJson(): string {
  const files: Record<string, string> = {
    'project.json': JSON.stringify(
      {
        projectType: 'library',
        targets: { build: {}, publish: {} },
      },
      null,
      2
    ),
    'src/index.ts': 'export {}\n',
  }

  const workspace = manager.create({ files })
  return workspace.root
}

const ruleTester = createTypeScriptRuleTester()

/**
 * Creates a valid test case for non-index.ts files (rule does not apply).
 *
 * @returns A valid test case configuration.
 */
function createNonIndexFileCase(): ValidTestCase<TestOptions> {
  return {
    name: 'ignores non-index.ts files',
    code: `export * from './foo'`,
    filename: '/some/path/exports.ts',
  }
}

/**
 * Creates a valid test case for non-publishable library (rule does not apply).
 *
 * @returns A valid test case configuration.
 */
function createNonPublishableLibraryCase(): ValidTestCase<TestOptions> {
  const projectDir = createNonPublishableProject()
  return {
    name: 'ignores non-publishable libraries',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for barrel file that is not an entry point (rule does not apply).
 *
 * @returns A valid test case configuration.
 */
function createNonEntryPointBarrelCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'ignores index.ts files that are not entry points',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'internal', 'index.ts'),
  }
}

/**
 * Creates a valid test case for project without package.json (rule does not apply).
 *
 * @returns A valid test case configuration.
 */
function createNoPackageJsonCase(): ValidTestCase<TestOptions> {
  const projectDir = createProjectWithoutPackageJson()
  return {
    name: 'ignores projects without package.json',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with explicit named exports.
 *
 * @returns A valid test case configuration.
 */
function createValidNamedExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows explicit named exports',
    code: `export { foo, bar } from './foo'
export { baz } from './bar'
export type { Qux } from './qux'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with explicit named type exports.
 *
 * @returns A valid test case configuration.
 */
function createValidTypeExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows explicit type exports',
    code: `export type { Type1, Type2 } from './types'
export { value } from './values'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for secondary entry point with named exports.
 *
 * @returns A valid test case configuration.
 */
function createValidSecondaryEntryPointCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './models': './src/models/index.js',
    },
  })
  return {
    name: 'allows secondary entry point with named exports',
    code: `export type { Model } from './model'
export { createModel } from './factory'`,
    filename: join(projectDir, 'src', 'models', 'index.ts'),
  }
}

/**
 * Creates a valid test case with export declarations (not re-exports).
 *
 * @returns A valid test case configuration.
 */
function createLocalExportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows local export declarations',
    code: `export const foo = 1
export function bar() {}
export class Baz {}
export type Qux = string`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates an invalid test case with star export.
 *
 * @returns An invalid test case configuration.
 */
function createStarExportCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags star export from module',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [
      {
        messageId: 'noStarExport',
        data: { source: './foo' },
      },
    ],
  }
}

/**
 * Creates an invalid test case with multiple star exports.
 *
 * @returns An invalid test case configuration.
 */
function createMultipleStarExportsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags multiple star exports',
    code: `export * from './foo'
export * from './bar'
export * from './baz'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [
      { messageId: 'noStarExport', data: { source: './foo' } },
      { messageId: 'noStarExport', data: { source: './bar' } },
      { messageId: 'noStarExport', data: { source: './baz' } },
    ],
  }
}

/**
 * Creates an invalid test case with type star export.
 *
 * @returns An invalid test case configuration.
 */
function createTypeStarExportCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags type star export',
    code: `export type * from './types'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [
      {
        messageId: 'noStarExportTypeOnly',
        data: { source: './types' },
      },
    ],
  }
}

/**
 * Creates an invalid test case with mixed star and named exports.
 *
 * @returns An invalid test case configuration.
 */
function createMixedExportsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags star export among valid named exports',
    code: `export { foo } from './foo'
export * from './bar'
export type { Baz } from './baz'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noStarExport', data: { source: './bar' } }],
  }
}

/**
 * Creates an invalid test case for secondary entry point with star export.
 *
 * @returns An invalid test case configuration.
 */
function createSecondaryEntryPointStarExportCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './models': './src/models/index.js',
    },
  })
  return {
    name: 'flags star export in secondary entry point',
    code: `export * from './model'`,
    filename: join(projectDir, 'src', 'models', 'index.ts'),
    errors: [{ messageId: 'noStarExport', data: { source: './model' } }],
  }
}

/**
 * Creates an invalid test case with star export with alias.
 *
 * @returns An invalid test case configuration.
 */
function createStarExportWithAliasCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags star export with namespace alias',
    code: `export * as foo from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noStarExport', data: { source: './foo' } }],
  }
}

/**
 * Creates a valid test case with conditional exports using 'import' key.
 *
 * @returns A valid test case configuration.
 */
function createConditionalExportImportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './utils': { import: './src/utils/index.js', require: './src/utils/index.cjs' },
    },
  })
  return {
    name: 'handles conditional exports with import key',
    code: `export { helper } from './helper'`,
    filename: join(projectDir, 'src', 'utils', 'index.ts'),
  }
}

/**
 * Creates a valid test case with conditional exports using only 'require' key.
 *
 * @returns A valid test case configuration.
 */
function createConditionalExportRequireOnlyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './cjs': { require: './src/cjs/index.cjs' },
    },
  })
  return {
    name: 'handles conditional exports with require key only',
    code: `export { cjsHelper } from './helper'`,
    filename: join(projectDir, 'src', 'cjs', 'index.ts'),
  }
}

/**
 * Creates a valid test case with conditional exports using only 'default' key.
 *
 * @returns A valid test case configuration.
 */
function createConditionalExportDefaultOnlyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './default': { default: './src/default/index.mjs' },
    },
  })
  return {
    name: 'handles conditional exports with default key only',
    code: `export { defaultHelper } from './helper'`,
    filename: join(projectDir, 'src', 'default', 'index.ts'),
  }
}

/**
 * Creates a valid test case with conditional export containing no recognized keys.
 *
 * @returns A valid test case configuration.
 */
function createConditionalExportNoRecognizedKeysCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './unknown': { node: './src/unknown.js', browser: './src/unknown.browser.js' },
    },
  })
  return {
    name: 'handles conditional exports with unrecognized keys (resolves to null)',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'unknown', 'index.ts'),
  }
}

/**
 * Creates an invalid test case with .cjs extension in export.
 *
 * @returns An invalid test case configuration.
 */
function createCjsExtensionEntryPointCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './cjs-entry': './src/cjs-entry/index.cjs',
    },
  })
  return {
    name: 'handles .cjs extension conversion to .ts',
    code: `export * from './module'`,
    filename: join(projectDir, 'src', 'cjs-entry', 'index.ts'),
    errors: [{ messageId: 'noStarExport', data: { source: './module' } }],
  }
}

/**
 * Creates an invalid test case with .mjs extension in export.
 *
 * @returns An invalid test case configuration.
 */
function createMjsExtensionEntryPointCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './mjs-entry': './src/mjs-entry/index.mjs',
    },
  })
  return {
    name: 'handles .mjs extension conversion to .ts',
    code: `export * from './module'`,
    filename: join(projectDir, 'src', 'mjs-entry', 'index.ts'),
    errors: [{ messageId: 'noStarExport', data: { source: './module' } }],
  }
}

/**
 * Creates a valid test case for index.ts outside any project root.
 *
 * @returns A valid test case configuration.
 */
function createNoProjectRootCase(): ValidTestCase<TestOptions> {
  return {
    name: 'ignores index.ts files outside project root',
    code: `export * from './foo'`,
    filename: '/tmp/random/index.ts',
  }
}

ruleTester.run('no-barrel-star-export', rule, {
  valid: [
    createNonIndexFileCase(),
    createNonPublishableLibraryCase(),
    createNonEntryPointBarrelCase(),
    createNoPackageJsonCase(),
    createValidNamedExportsCase(),
    createValidTypeExportsCase(),
    createValidSecondaryEntryPointCase(),
    createLocalExportCase(),
    createConditionalExportImportCase(),
    createConditionalExportRequireOnlyCase(),
    createConditionalExportDefaultOnlyCase(),
    createConditionalExportNoRecognizedKeysCase(),
    createNoProjectRootCase(),
  ],
  invalid: [
    createStarExportCase(),
    createMultipleStarExportsCase(),
    createTypeStarExportCase(),
    createMixedExportsCase(),
    createSecondaryEntryPointStarExportCase(),
    createStarExportWithAliasCase(),
    createCjsExtensionEntryPointCase(),
    createMjsExtensionEntryPointCase(),
  ],
})
