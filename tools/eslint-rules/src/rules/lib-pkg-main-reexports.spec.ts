import { join } from 'node:path'
import { createTempWorkspaceManager, createTypeScriptRuleTester, PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../testing'
import rule from './lib-pkg-main-reexports'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - The project.json content.
 * @param config.packageJson - The package.json content.
 * @param config.files - Additional files to create.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object; files?: Record<string, string> }): string {
  const tempFiles: Record<string, string> = {}

  if (config.projectJson) {
    tempFiles['project.json'] = JSON.stringify(config.projectJson, null, 2)
  }

  if (config.packageJson) {
    tempFiles['package.json'] = JSON.stringify(config.packageJson, null, 2)
  }

  if (config.files) {
    for (const [path, content] of Object.entries(config.files)) {
      tempFiles[path] = content
    }
  }

  const workspace = manager.create({ files: tempFiles })
  return workspace.root
}

const ruleTester = createTypeScriptRuleTester()

/**
 * Creates valid test case: non-main entry point file.
 *
 * @returns A valid test case configuration.
 */
function createNonMainEntryCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
      },
    },
  })
  return {
    code: "export * from './create-action';",
    filename: join(projectDir, 'src', 'actions', 'index.ts'),
  }
}

/**
 * Creates valid test case: main entry with all re-exports.
 *
 * @returns A valid test case configuration.
 */
function createCompleteBarrelCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './events': './src/events/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';\nexport * from './events';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: isomorphic topology skips validation.
 *
 * @returns A valid test case configuration.
 */
function createIsomorphicTopologyCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/crypto',
      exports: {
        './browser': './src/browser/index.js',
        './node': './src/node/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './hash';",
    filename: join(projectDir, 'src', 'browser', 'index.ts'),
    options: [{ topology: 'isomorphic' }] as const,
  }
}

/**
 * Creates valid test case: fragmented topology skips validation.
 *
 * @returns A valid test case configuration.
 */
function createFragmentedTopologyCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
      },
    },
  })
  return {
    code: "// No re-export needed for fragmented\nexport const version = '1.0.0';",
    filename: join(projectDir, 'src', 'index.ts'),
    options: [{ topology: 'fragmented' }] as const,
  }
}

/**
 * Creates valid test case: single entry point (no secondary entries).
 *
 * @returns A valid test case configuration.
 */
function createSingleEntryCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: 'export const foo = 1;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: excluded entry points.
 *
 * @returns A valid test case configuration.
 */
function createExcludedEntriesCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './testing': './src/testing/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
    options: [{ exclude: ['./testing'] }] as [{ exclude: string[] }],
  }
}

/**
 * Creates valid test case: named exports count as re-exports.
 *
 * @returns A valid test case configuration.
 */
function createNamedExportsCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './models': './src/models/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export type { Model, Config } from './models';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: non-publishable library.
 *
 * @returns A valid test case configuration.
 */
function createNonPublishableCase() {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {} },
    },
    packageJson: {
      name: '@test/internal',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
      },
    },
  })
  return {
    code: 'export const foo = 1;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: nested entry points - only need top-level re-export.
 *
 * @returns A valid test case configuration.
 */
function createNestedEntriesCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './changelog': './src/changelog/index.js',
        './changelog/parse': './src/changelog/parse/index.js',
        './changelog/serialize': './src/changelog/serialize/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './changelog';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates invalid test case: missing one re-export.
 *
 * @returns An invalid test case configuration.
 */
function createMissingReexportCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './events': './src/events/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingReexport' as const, data: { directory: 'events' } }],
  }
}

/**
 * Creates invalid test case: missing multiple re-exports.
 *
 * @returns An invalid test case configuration.
 */
function createMissingMultipleReexportsCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './events': './src/events/index.js',
        './models': './src/models/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [
      { messageId: 'missingReexport' as const, data: { directory: 'events' } },
      { messageId: 'missingReexport' as const, data: { directory: 'models' } },
    ],
  }
}

/**
 * Creates invalid test case: empty main entry with secondary exports.
 *
 * @returns An invalid test case configuration.
 */
function createEmptyMainCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './utils': './src/utils/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export const version = '1.0.0';",
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'missingReexport' as const, data: { directory: 'utils' } }],
  }
}

/**
 * Creates valid test case: conditional exports with 'import' field.
 *
 * @returns A valid test case configuration.
 */
function createConditionalImportExportsCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': {
          import: './src/index.js',
          require: './src/index.cjs',
        },
        './actions': {
          import: './src/actions/index.js',
          require: './src/actions/index.cjs',
        },
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: conditional exports with 'require' field only (no import).
 *
 * @returns A valid test case configuration.
 */
function createConditionalRequireOnlyCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': {
          require: './src/index.cjs',
        },
        './utils': {
          require: './src/utils/index.cjs',
        },
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './utils';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: conditional exports with 'default' field only.
 *
 * @returns A valid test case configuration.
 */
function createConditionalDefaultOnlyCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': {
          default: './src/index.js',
        },
        './helpers': {
          default: './src/helpers/index.js',
        },
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './helpers';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: package with no exports field.
 *
 * @returns A valid test case configuration.
 */
function createNoExportsFieldCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      main: './dist/index.js',
    },
  })
  return {
    code: 'export const foo = 1;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: exports from external module (not relative).
 *
 * @returns A valid test case configuration.
 */
function createExternalModuleExportCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from 'external-package';\nexport * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: named export from external module.
 *
 * @returns A valid test case configuration.
 */
function createNamedExportFromExternalCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './models': './src/models/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export { something } from 'lodash';\nexport * from './models';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: export from './' (current directory).
 *
 * @returns A valid test case configuration.
 */
function createExportFromCurrentDirCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './';\nexport * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: local export declaration without source.
 *
 * @returns A valid test case configuration.
 */
function createLocalExportDeclarationCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        './actions': './src/actions/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "const foo = 1;\nexport { foo };\nexport * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: main entry using .mjs extension in exports.
 *
 * @returns A valid test case configuration.
 */
function createMjsExtensionCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.mjs',
        './actions': './src/actions/index.mjs',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: main entry using .cjs extension in exports.
 *
 * @returns A valid test case configuration.
 */
function createCjsExtensionCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.cjs',
        './utils': './src/utils/index.cjs',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './utils';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: conditional exports with unrecognized fields only.
 * Export is skipped since resolveExportPath returns null.
 *
 * @returns A valid test case configuration.
 */
function createConditionalUnrecognizedFieldsCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': {
          types: './src/index.d.ts',
          browser: './src/index.browser.js',
        },
        './actions': './src/actions/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: 'export const foo = 1;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: export key without ./ prefix (non-standard).
 *
 * @returns A valid test case configuration.
 */
function createNonStandardExportKeyCase() {
  const projectDir = createTempProject({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: '@test/lib',
      exports: {
        '.': './src/index.js',
        actions: './src/actions/index.js',
        './package.json': './package.json',
      },
    },
  })
  return {
    code: "export * from './actions';",
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates valid test case: file outside project root (no project.json found).
 *
 * @returns A valid test case configuration.
 */
function createNoProjectRootCase() {
  return {
    code: 'export const foo = 1;',
    filename: '/tmp/random/src/index.ts',
  }
}

ruleTester.run('lib-pkg-main-reexports', rule, {
  valid: [
    {
      name: 'non-main entry point file skipped',
      ...createNonMainEntryCase(),
    },
    {
      name: 'complete barrel re-exports all secondary entries',
      ...createCompleteBarrelCase(),
    },
    {
      name: 'isomorphic topology skips validation',
      ...createIsomorphicTopologyCase(),
    },
    {
      name: 'fragmented topology skips validation',
      ...createFragmentedTopologyCase(),
    },
    {
      name: 'single entry point (only main and package.json)',
      ...createSingleEntryCase(),
    },
    {
      name: 'excluded entry points are not required',
      ...createExcludedEntriesCase(),
    },
    {
      name: 'named exports count as re-exports',
      ...createNamedExportsCase(),
    },
    {
      name: 'non-publishable libraries skipped',
      ...createNonPublishableCase(),
    },
    {
      name: 'nested entries need only top-level re-export',
      ...createNestedEntriesCase(),
    },
    {
      name: 'conditional exports with import field',
      ...createConditionalImportExportsCase(),
    },
    {
      name: 'conditional exports with require field only',
      ...createConditionalRequireOnlyCase(),
    },
    {
      name: 'conditional exports with default field only',
      ...createConditionalDefaultOnlyCase(),
    },
    {
      name: 'package with no exports field skipped',
      ...createNoExportsFieldCase(),
    },
    {
      name: 'export all from external module ignored',
      ...createExternalModuleExportCase(),
    },
    {
      name: 'named export from external module ignored',
      ...createNamedExportFromExternalCase(),
    },
    {
      name: 'export from current directory ignored',
      ...createExportFromCurrentDirCase(),
    },
    {
      name: 'local export declaration without source',
      ...createLocalExportDeclarationCase(),
    },
    {
      name: 'main entry with .mjs extension',
      ...createMjsExtensionCase(),
    },
    {
      name: 'main entry with .cjs extension',
      ...createCjsExtensionCase(),
    },
    {
      name: 'conditional exports with unrecognized fields only',
      ...createConditionalUnrecognizedFieldsCase(),
    },
    {
      name: 'export key without ./ prefix (non-standard)',
      ...createNonStandardExportKeyCase(),
    },
    {
      name: 'file outside project root skipped',
      ...createNoProjectRootCase(),
    },
  ],
  invalid: [
    {
      name: 'reports missing re-export for one entry',
      ...createMissingReexportCase(),
    },
    {
      name: 'reports missing re-exports for multiple entries',
      ...createMissingMultipleReexportsCase(),
    },
    {
      name: 'reports when main has no re-exports',
      ...createEmptyMainCase(),
    },
  ],
})
