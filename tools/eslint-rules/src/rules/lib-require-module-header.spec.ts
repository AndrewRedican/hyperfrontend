import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule, { RULE_NAME } from './lib-require-module-header'

type TestOptions = readonly []
type MessageIds = 'missingModuleHeader'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

type ExportValue = string | Record<string, string>

/**
 * Creates a temporary publishable library with custom package.json exports.
 *
 * @param config - Configuration for the temporary project.
 * @param config.exports - Optional exports field for package.json.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { exports?: Record<string, ExportValue> } = {}): string {
  const files: Record<string, string> = {}

  files['project.json'] = JSON.stringify(
    {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    null,
    2
  )

  const packageJsonExports: Record<string, ExportValue> = {
    '.': './src/index.js',
    './package.json': './package.json',
    ...config.exports,
  }

  files['package.json'] = JSON.stringify(
    {
      name: '@hyperfrontend/test-lib',
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
  const projectDir = createTempProject()
  return {
    name: 'ignores index.ts files that are not entry points',
    code: `export * from './foo'`,
    filename: join(projectDir, 'src', 'internal', 'index.ts'),
  }
}

/**
 * Creates a valid test case for project without package.json.
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
 * Creates a valid test case with proper \@module header.
 *
 * @returns A valid test case configuration.
 */
function createValidModuleHeaderCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows entry point with @module header',
    code: `/**
 * @module @hyperfrontend/test-lib
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with \@module header and description.
 *
 * @returns A valid test case configuration.
 */
function createValidModuleHeaderWithDescriptionCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows entry point with @module header and description',
    code: `/**
 * Test library for utilities.
 *
 * This package provides utilities for testing.
 *
 * @module @hyperfrontend/test-lib
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates an invalid test case for entry point missing \@module header.
 *
 * @returns An invalid test case configuration.
 */
function createMissingModuleHeaderCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports entry point missing @module header',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates an invalid test case for entry point with JSDoc but no \@module tag.
 *
 * @returns An invalid test case configuration.
 */
function createJsDocWithoutModuleCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports JSDoc comment without @module tag',
    code: `/**
 * This is a description without module tag.
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates an invalid test case for entry point with line comment instead of JSDoc.
 *
 * @returns An invalid test case configuration.
 */
function createLineCommentCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports line comment instead of JSDoc',
    code: `// @module @hyperfrontend/test-lib
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates an invalid test case for entry point with JSDoc not at line 1.
 *
 * @returns An invalid test case configuration.
 */
function createJsDocNotAtStartCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports JSDoc not starting at line 1',
    code: `
/**
 * @module @hyperfrontend/test-lib
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates a valid test case for secondary entrypoint with \@module header.
 *
 * @returns A valid test case configuration.
 */
function createSecondaryEntrypointCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: { './utils': './src/utils/index.js' },
  })
  return {
    name: 'allows secondary entry point with @module header',
    code: `/**
 * @module @hyperfrontend/test-lib/utils
 */
export * from './helpers'`,
    filename: join(projectDir, 'src', 'utils', 'index.ts'),
  }
}

/**
 * Creates an invalid test case for secondary entrypoint missing \@module header.
 *
 * @returns An invalid test case configuration.
 */
function createSecondaryEntrypointMissingCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    exports: { './utils': './src/utils/index.js' },
  })
  return {
    name: 'reports secondary entry point missing @module header',
    code: `export * from './helpers'`,
    filename: join(projectDir, 'src', 'utils', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates a valid test case for entry point defined with object export using `import` key.
 *
 * @returns A valid test case configuration.
 */
function createExportWithImportKeyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: { './utils': { import: './src/utils/index.js' } },
  })
  return {
    name: 'allows entry point defined via export object with import key',
    code: `/**
 * @module @hyperfrontend/test-lib/utils
 */
export * from './helpers'`,
    filename: join(projectDir, 'src', 'utils', 'index.ts'),
  }
}

/**
 * Creates a valid test case for entry point defined with object export using `require` key.
 *
 * @returns A valid test case configuration.
 */
function createExportWithRequireKeyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: { './cjs': { require: './src/cjs/index.cjs' } },
  })
  return {
    name: 'allows entry point defined via export object with require key',
    code: `/**
 * @module @hyperfrontend/test-lib/cjs
 */
export * from './helpers'`,
    filename: join(projectDir, 'src', 'cjs', 'index.ts'),
  }
}

/**
 * Creates a valid test case for entry point defined with object export using `default` key.
 *
 * @returns A valid test case configuration.
 */
function createExportWithDefaultKeyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: { './esm': { default: './src/esm/index.mjs' } },
  })
  return {
    name: 'allows entry point defined via export object with default key',
    code: `/**
 * @module @hyperfrontend/test-lib/esm
 */
export * from './helpers'`,
    filename: join(projectDir, 'src', 'esm', 'index.ts'),
  }
}

/**
 * Creates a valid test case for export object with no recognized keys (not an entry point).
 *
 * @returns A valid test case configuration.
 */
function createExportWithUnrecognizedKeysCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    exports: { './other': { types: './src/other/index.d.ts' } as unknown as Record<string, string> },
  })
  return {
    name: 'ignores export object with no recognized keys (types only)',
    code: `export * from './helpers'`,
    filename: join(projectDir, 'src', 'other', 'index.ts'),
  }
}

/**
 * Creates a valid test case with \@module at end of comment (no trailing character).
 *
 * @returns A valid test case configuration.
 */
function createModuleAtEndCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows @module at end of JSDoc comment',
    code: `/** @module */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with \@module followed by tab.
 *
 * @returns A valid test case configuration.
 */
function createModuleWithTabCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows @module followed by tab',
    code: `/**\n * @module\t@hyperfrontend/test-lib\n */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with \@module followed by newline.
 *
 * @returns A valid test case configuration.
 */
function createModuleWithNewlineCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows @module followed by newline',
    code: `/**
 * @module
 * @hyperfrontend/test-lib
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case with \@module followed by carriage return.
 *
 * @returns A valid test case configuration.
 */
function createModuleWithCarriageReturnCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'allows @module followed by carriage return',
    code: `/**\r\n * @module\r\n */\r\nexport * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates an invalid test case with \@moduleX (not a valid \@module tag).
 *
 * @returns An invalid test case configuration.
 */
function createModuleXFalsePositiveCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports @moduleX as missing @module (substring not valid)',
    code: `/**
 * @moduleX @hyperfrontend/test-lib
 */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

/**
 * Creates an invalid test case with block comment that is not JSDoc style.
 *
 * @returns An invalid test case configuration.
 */
function createBlockCommentNotJsDocCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    name: 'reports block comment without JSDoc asterisk',
    code: `/* @module @hyperfrontend/test-lib */
export * from './foo'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingModuleHeader' }],
  }
}

ruleTester.run(RULE_NAME, rule, {
  valid: [
    createNonIndexFileCase(),
    createNonPublishableLibraryCase(),
    createNonEntryPointBarrelCase(),
    createNoPackageJsonCase(),
    createValidModuleHeaderCase(),
    createValidModuleHeaderWithDescriptionCase(),
    createSecondaryEntrypointCase(),
    createExportWithImportKeyCase(),
    createExportWithRequireKeyCase(),
    createExportWithDefaultKeyCase(),
    createExportWithUnrecognizedKeysCase(),
    createModuleAtEndCase(),
    createModuleWithTabCase(),
    createModuleWithNewlineCase(),
    createModuleWithCarriageReturnCase(),
  ],
  invalid: [
    createMissingModuleHeaderCase(),
    createJsDocWithoutModuleCase(),
    createLineCommentCase(),
    createJsDocNotAtStartCase(),
    createSecondaryEntrypointMissingCase(),
    createModuleXFalsePositiveCase(),
    createBlockCommentNotJsDocCase(),
  ],
})
