import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-tsconfig-paths'

const manager = createTempWorkspaceManager()

/**
 * Creates a temporary workspace structure for testing.
 *
 * @param config - Configuration for the temporary workspace.
 * @param config.tsconfigBasePaths - Path mappings for tsconfig.base.json.
 * @param config.libraries - Array of library configurations.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: {
  tsconfigBasePaths?: Record<string, string[]>
  libraries?: Array<{
    name: string
    path: string
    exports: Record<string, string | { import?: string; require?: string; default?: string }>
    sourceFiles?: string[]
    projectType?: string
    hasPublish?: boolean
  }>
}): string {
  // Build the files map
  const files: Record<string, string> = {}

  // Add tsconfig.base.json
  files['tsconfig.base.json'] = JSON.stringify(
    {
      compilerOptions: {
        baseUrl: '.',
        paths: config.tsconfigBasePaths ?? {},
      },
    },
    null,
    2
  )

  // Create library projects
  if (config.libraries) {
    for (const lib of config.libraries) {
      // Create project.json
      const projectJson = {
        projectType: lib.projectType ?? 'library',
        targets: {
          build: {},
          ...(lib.hasPublish !== false ? { publish: {} } : {}),
        },
      }
      files[join(lib.path, 'project.json')] = JSON.stringify(projectJson, null, 2)

      // Create package.json
      const packageJson = {
        name: lib.name,
        exports: lib.exports,
      }
      files[join(lib.path, 'package.json')] = JSON.stringify(packageJson, null, 2)

      // Create source files
      const sourceFiles = lib.sourceFiles ?? ['src/index.ts']
      for (const file of sourceFiles) {
        files[join(lib.path, file)] = '// generated for test'
      }
    }
  }

  const workspace = manager.create({
    files,
    directories: ['libs'],
  })

  return workspace.root
}

const ruleTester = createJsonRuleTester()

describe('lib-tsconfig-paths', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-tsconfig-paths', rule, {
    valid: [
      {
        name: 'passes when all library entry points have path mappings',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-lib/utils': ['libs/my-lib/src/utils/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {
                  '@test/my-lib': ['libs/my-lib/src/index.ts'],
                  '@test/my-lib/utils': ['libs/my-lib/src/utils/index.ts'],
                },
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-lib/utils': ['libs/my-lib/src/utils/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
      {
        name: 'ignores application projects',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-app',
                path: 'libs/my-app',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
                projectType: 'application',
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-app',
                path: 'libs/my-app',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
                projectType: 'application',
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
      {
        name: 'skips non-tsconfig.base.json files',
        code: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ),
        options: [{ libraryDirectories: ['libs'] }],
        filename: '/tmp/other-tsconfig.json',
      },
      {
        name: 'ignores package.json self-references',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './package.json': './package.json',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {
                  '@test/my-lib': ['libs/my-lib/src/index.ts'],
                },
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './package.json': './package.json',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
      {
        name: 'scans multiple libraryDirectories including tools and plugins',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-plugin': ['plugins/my-plugin/src/index.ts'],
              '@test/my-tool': ['tools/my-tool/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/my-plugin',
                path: 'plugins/my-plugin',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/my-tool',
                path: 'tools/my-tool',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {
                  '@test/my-lib': ['libs/my-lib/src/index.ts'],
                  '@test/my-plugin': ['plugins/my-plugin/src/index.ts'],
                  '@test/my-tool': ['tools/my-tool/src/index.ts'],
                },
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs', 'plugins', 'tools'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-plugin': ['plugins/my-plugin/src/index.ts'],
              '@test/my-tool': ['tools/my-tool/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/my-plugin',
                path: 'plugins/my-plugin',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/my-tool',
                path: 'tools/my-tool',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
      {
        name: 'respects excludePatterns to skip fixture directories',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              // This fixture library should be excluded
              {
                name: '@test/fixture-lib',
                path: 'libs/my-lib/__fixtures__/fixture-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          // Should pass because fixture-lib is excluded and not expected in paths
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {
                  '@test/my-lib': ['libs/my-lib/src/index.ts'],
                },
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'], excludePatterns: ['__fixtures__'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/fixture-lib',
                path: 'libs/my-lib/__fixtures__/fixture-lib',
                exports: { '.': './src/index.js' },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
      {
        name: 'passes when no libraryDirectories are configured (skips processing)',
        code: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {
                '@random/package': ['some/random/path.ts'],
              },
            },
          },
          null,
          2
        ),
        // No options provided - rule should skip processing
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing main entry point path mapping',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: '.',
              pathAlias: '@test/my-lib',
              sourcePath: 'libs/my-lib/src/index.ts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/my-lib": ["libs/my-lib/src/index.ts"]\n    }'),
      },
      {
        name: 'reports missing secondary entry point path mapping',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {
                  '@test/my-lib': ['libs/my-lib/src/index.ts'],
                },
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: './utils',
              pathAlias: '@test/my-lib/utils',
              sourcePath: 'libs/my-lib/src/utils/index.ts',
            },
          },
        ],
        output:
          '{\n' +
          '  "compilerOptions": {\n' +
          '    "baseUrl": ".",\n' +
          '    "paths": {\n' +
          '      "@test/my-lib": ["libs/my-lib/src/index.ts"],\n' +
          '      "@test/my-lib/utils": ["libs/my-lib/src/utils/index.ts"]\n' +
          '    }\n' +
          '  }\n' +
          '}',
      },
      {
        name: 'reports multiple missing entry points',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                  './helpers': './src/helpers/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts', 'src/helpers/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                  './helpers': './src/helpers/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts', 'src/helpers/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [{ messageId: 'missingPathMapping' }, { messageId: 'missingPathMapping' }, { messageId: 'missingPathMapping' }],
        output:
          '{\n' +
          '  "compilerOptions": {\n' +
          '    "baseUrl": ".",\n' +
          '    "paths": {\n' +
          '      "@test/my-lib": ["libs/my-lib/src/index.ts"],\n' +
          '      "@test/my-lib/helpers": ["libs/my-lib/src/helpers/index.ts"],\n' +
          '      "@test/my-lib/utils": ["libs/my-lib/src/utils/index.ts"]\n' +
          '    }\n' +
          '  }\n' +
          '}',
      },
      {
        name: 'reports orphan path mapping pointing to non-existent file',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-lib/deleted': ['libs/my-lib/src/deleted/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/my-lib": ["libs/my-lib/src/index.ts"],
      "@test/my-lib/deleted": ["libs/my-lib/src/deleted/index.ts"]
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/my-lib/deleted': ['libs/my-lib/src/deleted/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'orphanPathMapping',
            data: {
              pathAlias: '@test/my-lib/deleted',
              sourcePath: 'libs/my-lib/src/deleted/index.ts',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/my-lib": ["libs/my-lib/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'reports unknown package mapping not matching any library',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/unknown-lib': ['libs/unknown-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/my-lib": ["libs/my-lib/src/index.ts"],
      "@test/unknown-lib": ["libs/unknown-lib/src/index.ts"]
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
              '@test/unknown-lib': ['libs/unknown-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'unknownPackageMapping',
            data: {
              pathAlias: '@test/unknown-lib',
              sourcePath: 'libs/unknown-lib/src/index.ts',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/my-lib": ["libs/my-lib/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'reports paths not organized when same package paths are not consecutive',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/lib-a': ['libs/lib-a/src/index.ts'],
              '@test/lib-b': ['libs/lib-b/src/index.ts'],
              '@test/lib-a/utils': ['libs/lib-a/src/utils/index.ts'],
            },
            libraries: [
              {
                name: '@test/lib-a',
                path: 'libs/lib-a',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
              {
                name: '@test/lib-b',
                path: 'libs/lib-b',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/lib-a": ["libs/lib-a/src/index.ts"],
      "@test/lib-b": ["libs/lib-b/src/index.ts"],
      "@test/lib-a/utils": ["libs/lib-a/src/utils/index.ts"]
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/lib-a': ['libs/lib-a/src/index.ts'],
              '@test/lib-b': ['libs/lib-b/src/index.ts'],
              '@test/lib-a/utils': ['libs/lib-a/src/utils/index.ts'],
            },
            libraries: [
              {
                name: '@test/lib-a',
                path: 'libs/lib-a',
                exports: {
                  '.': './src/index.js',
                  './utils': './src/utils/index.js',
                },
                sourceFiles: ['src/index.ts', 'src/utils/index.ts'],
              },
              {
                name: '@test/lib-b',
                path: 'libs/lib-b',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'pathsNotOrganized',
            data: {
              packageName: '@test/lib-a',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/lib-a": ["libs/lib-a/src/index.ts"],
      "@test/lib-a/utils": ["libs/lib-a/src/utils/index.ts"],
      "@test/lib-b": ["libs/lib-b/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'handles conditional exports with import key',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': { import: './src/index.js', require: './src/index.cjs' },
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': { import: './src/index.js', require: './src/index.cjs' },
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: '.',
              pathAlias: '@test/my-lib',
              sourcePath: 'libs/my-lib/src/index.ts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/my-lib": ["libs/my-lib/src/index.ts"]\n    }'),
      },
      {
        name: 'handles conditional exports with default key',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': { default: './src/index.js' },
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': { default: './src/index.js' },
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: '.',
              pathAlias: '@test/my-lib',
              sourcePath: 'libs/my-lib/src/index.ts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/my-lib": ["libs/my-lib/src/index.ts"]\n    }'),
      },
      {
        name: 'handles .mjs exports resolving to .mts files',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.mjs',
                },
                sourceFiles: ['src/index.mts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.mjs',
                },
                sourceFiles: ['src/index.mts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: '.',
              pathAlias: '@test/my-lib',
              sourcePath: 'libs/my-lib/src/index.mts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/my-lib": ["libs/my-lib/src/index.mts"]\n    }'),
      },
      {
        name: 'handles .cjs exports resolving to .cts files',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.cjs',
                },
                sourceFiles: ['src/index.cts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.cjs',
                },
                sourceFiles: ['src/index.cts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/my-lib',
              exportKey: '.',
              pathAlias: '@test/my-lib',
              sourcePath: 'libs/my-lib/src/index.cts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/my-lib": ["libs/my-lib/src/index.cts"]\n    }'),
      },
      {
        name: 'inserts new path mapping before existing entries alphabetically',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/z-lib': ['libs/z-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/a-lib',
                path: 'libs/a-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/z-lib',
                path: 'libs/z-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/z-lib": ["libs/z-lib/src/index.ts"]
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/z-lib': ['libs/z-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/a-lib',
                path: 'libs/a-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/z-lib',
                path: 'libs/z-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/a-lib',
              exportKey: '.',
              pathAlias: '@test/a-lib',
              sourcePath: 'libs/a-lib/src/index.ts',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/a-lib": ["libs/a-lib/src/index.ts"],
      "@test/z-lib": ["libs/z-lib/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'handles inserting after entry with trailing comma',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/a-lib': ['libs/a-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/a-lib',
                path: 'libs/a-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/z-lib',
                path: 'libs/z-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/a-lib": ["libs/a-lib/src/index.ts"],
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/a-lib': ['libs/a-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/a-lib',
                path: 'libs/a-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
              {
                name: '@test/z-lib',
                path: 'libs/z-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/z-lib',
              exportKey: '.',
              pathAlias: '@test/z-lib',
              sourcePath: 'libs/z-lib/src/index.ts',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/a-lib": ["libs/a-lib/src/index.ts"],
      "@test/z-lib": ["libs/z-lib/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'removes orphan path that is first in the list',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {
              '@test/deleted-lib': ['libs/deleted-lib/src/index.ts'],
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/deleted-lib": ["libs/deleted-lib/src/index.ts"],
      "@test/my-lib": ["libs/my-lib/src/index.ts"]
    }
  }
}`
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {
              '@test/deleted-lib': ['libs/deleted-lib/src/index.ts'],
              '@test/my-lib': ['libs/my-lib/src/index.ts'],
            },
            libraries: [
              {
                name: '@test/my-lib',
                path: 'libs/my-lib',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'unknownPackageMapping',
            data: {
              pathAlias: '@test/deleted-lib',
              sourcePath: 'libs/deleted-lib/src/index.ts',
            },
          },
        ],
        output: `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@test/my-lib": ["libs/my-lib/src/index.ts"]
    }
  }
}`,
      },
      {
        name: 'handles nested library directories',
        code: (() => {
          createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/utils/string',
                path: 'libs/utils/string',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                paths: {},
              },
            },
            null,
            2
          )
        })(),
        options: [{ libraryDirectories: ['libs'] }],
        filename: (() => {
          const workspace = createTempWorkspace({
            tsconfigBasePaths: {},
            libraries: [
              {
                name: '@test/utils/string',
                path: 'libs/utils/string',
                exports: {
                  '.': './src/index.js',
                },
                sourceFiles: ['src/index.ts'],
              },
            ],
          })
          return join(workspace, 'tsconfig.base.json')
        })(),
        errors: [
          {
            messageId: 'missingPathMapping',
            data: {
              packageName: '@test/utils/string',
              exportKey: '.',
              pathAlias: '@test/utils/string',
              sourcePath: 'libs/utils/string/src/index.ts',
            },
          },
        ],
        output: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {},
            },
          },
          null,
          2
        ).replace('"paths": {}', '"paths": {\n      "@test/utils/string": ["libs/utils/string/src/index.ts"]\n    }'),
      },
    ],
  })
})
