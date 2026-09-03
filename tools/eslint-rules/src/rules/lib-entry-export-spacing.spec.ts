import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule from './lib-entry-export-spacing'

type TestOptions = readonly []
type MessageIds = 'noBlankLinesBetweenExports'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/**
 * Creates a temporary publishable library with custom package.json exports.
 *
 * @param config - Configuration for the temporary project.
 * @param config.exports - Optional exports field for package.json. If undefined, no exports field is added.
 * @param config.includeExports - Whether to include the exports field (default: true).
 * @returns The path to the temporary project directory.
 */
function createTempProjectWithCustomExports(config: {
  exports?: Record<string, string | Record<string, string>>
  includeExports?: boolean
}): string {
  const files: Record<string, string> = {}

  files['project.json'] = JSON.stringify(
    {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    null,
    2
  )

  const packageJson: Record<string, unknown> = {
    name: 'test-lib',
  }

  if (config.includeExports !== false && config.exports !== undefined) {
    packageJson['exports'] = config.exports
  }

  files['package.json'] = JSON.stringify(packageJson, null, 2)
  files['src/index.ts'] = 'export {}\n'

  const workspace = manager.create({ files })
  return workspace.root
}

/**
 * Creates a publishable project with project.json but NO package.json.
 * This tests the branch where readJsonFileIfExists returns null.
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
 * Creates a temporary publishable library project.
 *
 * @param config - Configuration for the temporary project.
 * @param config.exports - Optional exports field for package.json.
 * @param config.indexFiles - Optional list of index files to create.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { exports?: Record<string, string>; indexFiles?: string[] }): string {
  const files: Record<string, string> = {}

  files['project.json'] = JSON.stringify(
    {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    null,
    2
  )

  const packageJsonExports: Record<string, string> = {
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

  if (config.indexFiles) {
    for (const indexFile of config.indexFiles) {
      files[indexFile] = 'export {}\n'
    }
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
    code: `export * from './foo'\n\nexport * from './bar'`,
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
    code: `export * from './foo'\n\nexport * from './bar'`,
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
    code: `export * from './foo'\n\nexport * from './bar'`,
    filename: join(projectDir, 'src', 'internal', 'index.ts'),
  }
}

/**
 * Creates a valid test case for exports without blank lines.
 *
 * @returns A valid test case configuration.
 */
function createValidExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows exports without blank lines',
    code: `export * from './foo'
export * from './bar'
export type { Baz } from './baz'
export { qux } from './qux'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for secondary entry point without blank lines.
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
    name: 'allows secondary entry point exports without blank lines',
    code: `export type { Model } from './model'
export { createModel } from './factory'`,
    filename: join(projectDir, 'src', 'models', 'index.ts'),
  }
}

/**
 * Creates a valid test case with a single export (no spacing issue possible).
 *
 * @returns A valid test case configuration.
 */
function createSingleExportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows single export statement',
    code: `export * from './lib'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case where exports are separated by comments.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithCommentCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows blank lines when comment exists between exports',
    code: `export * from './foo'

// Models
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates an invalid test case with one blank line between exports.
 *
 * @returns An invalid test case configuration.
 */
function createSingleBlankLineCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags single blank line between exports',
    code: `export * from './foo'

export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './foo'
export * from './bar'`,
  }
}

/**
 * Creates an invalid test case with multiple blank lines between exports.
 *
 * @returns An invalid test case configuration.
 */
function createMultipleBlankLinesCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags multiple blank lines between exports',
    code: `export * from './foo'


export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './foo'
export * from './bar'`,
  }
}

/**
 * Creates an invalid test case with multiple violations.
 *
 * @returns An invalid test case configuration.
 */
function createMultipleViolationsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags multiple blank line violations',
    code: `export * from './foo'

export type { Bar } from './bar'

export { baz } from './baz'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }, { messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './foo'
export type { Bar } from './bar'
export { baz } from './baz'`,
  }
}

/**
 * Creates an invalid test case for secondary entry point.
 *
 * @returns An invalid test case configuration.
 */
function createSecondaryEntryPointViolationCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    exports: {
      './actions': './src/actions/index.js',
    },
  })
  return {
    name: 'flags violation in secondary entry point',
    code: `export type { Action } from './action'

export { createAction } from './factory'`,
    filename: join(projectDir, 'src', 'actions', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export type { Action } from './action'
export { createAction } from './factory'`,
  }
}

/**
 * Creates an invalid test case with multi-line export followed by blank line.
 *
 * @returns An invalid test case configuration.
 */
function createMultiLineExportCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags blank line after multi-line export',
    code: `export {
  foo,
  bar,
  baz,
} from './lib'

export * from './utils'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export {
  foo,
  bar,
  baz,
} from './lib'
export * from './utils'`,
  }
}

/**
 * Tests resolveExportValue with object containing `require` key (but no `import`).
 * Exercises the `require` fallback branch in resolveExportValue.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithRequireKeyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    exports: {
      '.': { require: './src/index.js' },
      './package.json': './package.json',
    },
  })
  return {
    name: 'handles exports with require key (no import)',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests resolveExportValue with object containing `default` key (but no `import`/`require`).
 * Exercises the `default` fallback branch in resolveExportValue.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithDefaultKeyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    exports: {
      '.': { default: './src/index.js' },
      './package.json': './package.json',
    },
  })
  return {
    name: 'handles exports with default key (no import/require)',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests resolveExportValue with object containing no valid keys (types-only).
 * Exercises the null return when no matching key is found.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithInvalidObjectKeysCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    exports: {
      '.': './src/index.js',
      './types': { types: './src/types.d.ts' },
      './package.json': './package.json',
    },
  })
  return {
    name: 'handles exports object with no valid keys (returns null)',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests getEntryPointPaths when package.json has no exports field.
 * Exercises the branch where `packageJson.exports` is undefined.
 *
 * @returns A valid test case configuration.
 */
function createNoExportsFieldCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    includeExports: false,
  })
  return {
    name: 'handles package.json without exports field',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests invalid case when package.json has no exports field.
 * This ensures the rule still works using default src/index.ts as entry point.
 *
 * @returns An invalid test case configuration.
 */
function createNoExportsFieldInvalidCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    includeExports: false,
  })
  return {
    name: 'flags violations when package.json has no exports field',
    code: `export * from './foo'

export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './foo'
export * from './bar'`,
  }
}

/**
 * Tests exports with .cjs extension replacement.
 * Exercises the `.cjs` regex branch in getEntryPointPaths.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithCjsExtensionCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    exports: {
      '.': './src/index.cjs',
      './package.json': './package.json',
    },
  })
  return {
    name: 'handles exports with .cjs extension',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests exports with .mjs extension replacement.
 * Exercises the `.mjs` regex branch in getEntryPointPaths.
 *
 * @returns A valid test case configuration.
 */
function createExportsWithMjsExtensionCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProjectWithCustomExports({
    exports: {
      '.': './src/index.mjs',
      './package.json': './package.json',
    },
  })
  return {
    name: 'handles exports with .mjs extension',
    code: `export * from './foo'
export * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests ExportDefaultDeclaration node type.
 * Exercises the `export default` branch in isExportStatement.
 *
 * @returns An invalid test case configuration.
 */
function createExportDefaultDeclarationCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags blank line before export default declaration',
    code: `export * from './foo'

export default function main() {}`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './foo'
export default function main() {}`,
  }
}

/**
 * Tests Windows-style path detection (\\index.ts).
 * Exercises the Windows path branch in the rule.
 *
 * @returns A valid test case configuration.
 */
function createWindowsPathCase(): ValidTestCase<TestOptions> {
  return {
    name: 'handles Windows-style paths for non-index files',
    code: `export * from './foo'\n\nexport * from './bar'`,
    filename: 'C:\\some\\path\\exports.ts',
  }
}

/**
 * Tests Windows-style index.ts path.
 * Exercises the Windows path branch when file IS an index.ts.
 *
 * @returns A valid test case configuration.
 */
function createWindowsIndexPathCase(): ValidTestCase<TestOptions> {
  return {
    name: 'handles Windows-style index.ts path without project root',
    code: `export * from './foo'\n\nexport * from './bar'`,
    filename: 'C:\\nonexistent\\project\\src\\index.ts',
  }
}

/**
 * Tests zero export statements.
 * Exercises the early return when exportStatements.length <= 1.
 *
 * @returns A valid test case configuration.
 */
function createZeroExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows entry point with no exports',
    code: `const internal = 'value'
console.log(internal)`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests case where project root cannot be found.
 * Exercises the early return when findProjectRoot returns null.
 *
 * @returns A valid test case configuration.
 */
function createNoProjectRootCase(): ValidTestCase<TestOptions> {
  return {
    name: 'ignores index.ts when no project root found',
    code: `export * from './foo'\n\nexport * from './bar'`,
    filename: '/nonexistent/deeply/nested/src/index.ts',
  }
}

/**
 * Tests case where project has project.json but no package.json.
 * Exercises the early return when readJsonFileIfExists returns null.
 *
 * @returns A valid test case configuration.
 */
function createNoPackageJsonCase(): ValidTestCase<TestOptions> {
  const projectDir = createProjectWithoutPackageJson()
  return {
    name: 'ignores index.ts when package.json is missing',
    code: `export * from './foo'\n\nexport * from './bar'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests blank line count is exactly zero (no blank lines).
 * Ensures the blankLineCount > 0 branch is exercised for the false case.
 *
 * @returns A valid test case configuration.
 */
function createNoBlankLinesBetweenExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows consecutive exports with no blank lines',
    code: `export * from './a'
export * from './b'
export * from './c'
export { d } from './d'`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests mixed export types without violations.
 * Exercises multiple export statement types together.
 *
 * @returns A valid test case configuration.
 */
function createMixedExportTypesValidCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'allows mixed export types without blank lines',
    code: `export * from './module'
export { foo, bar } from './utils'
export type { FooType } from './types'
export default class Main {}`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Tests mixed export types with violation.
 * Exercises all export statement types in invalid scenario.
 *
 * @returns An invalid test case configuration.
 */
function createMixedExportTypesInvalidCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({})
  return {
    name: 'flags mixed export types with blank lines',
    code: `export * from './module'
export { foo, bar } from './utils'

export type { FooType } from './types'
export default class Main {}`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'noBlankLinesBetweenExports' }],
    output: `export * from './module'
export { foo, bar } from './utils'
export type { FooType } from './types'
export default class Main {}`,
  }
}

ruleTester.run('lib-entry-export-spacing', rule, {
  valid: [
    createNonIndexFileCase(),
    createNonPublishableLibraryCase(),
    createNonEntryPointBarrelCase(),
    createValidExportsCase(),
    createValidSecondaryEntryPointCase(),
    createSingleExportCase(),
    createExportsWithCommentCase(),
    createExportsWithRequireKeyCase(),
    createExportsWithDefaultKeyCase(),
    createExportsWithInvalidObjectKeysCase(),
    createNoExportsFieldCase(),
    createExportsWithCjsExtensionCase(),
    createExportsWithMjsExtensionCase(),
    createWindowsPathCase(),
    createWindowsIndexPathCase(),
    createZeroExportsCase(),
    createNoProjectRootCase(),
    createNoPackageJsonCase(),
    createNoBlankLinesBetweenExportsCase(),
    createMixedExportTypesValidCase(),
  ],
  invalid: [
    createSingleBlankLineCase(),
    createMultipleBlankLinesCase(),
    createMultipleViolationsCase(),
    createSecondaryEntryPointViolationCase(),
    createMultiLineExportCase(),
    createExportDefaultDeclarationCase(),
    createNoExportsFieldInvalidCase(),
    createMixedExportTypesInvalidCase(),
  ],
})
