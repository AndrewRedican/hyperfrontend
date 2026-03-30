import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  APPLICATION_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-exports-exist'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

describe('lib-pkg-exports-exist', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-exports-exist', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: { ...APPLICATION_PROJECT_JSON, targets: { ...APPLICATION_PROJECT_JSON.targets, publish: {} } },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when all export paths exist',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './utils': './src/utils/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: {
              'src/index.js': '// generated for test',
              'src/utils/index.js': '// generated for test',
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when package.json export is present',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './package.json': './package.json',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
                './package.json': './package.json',
              },
            },
            files: {
              'src/index.js': '// generated for test',
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes with conditional exports when all paths exist',
        code: JSON.stringify(
          {
            exports: {
              '.': {
                import: './src/index.mjs',
                require: './src/index.cjs',
              },
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: {
              'src/index.mjs': '// generated for test',
              'src/index.cjs': '// generated for test',
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when .js exports point to existing .ts source files',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './utils': './src/utils/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: {
              'src/index.ts': '// generated for test',
              'src/utils/index.ts': '// generated for test',
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when .mjs exports point to existing .ts source files',
        code: JSON.stringify(
          {
            exports: {
              '.': {
                import: './src/index.mjs',
                require: './src/index.cjs',
              },
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: {
              'src/index.ts': '// generated for test',
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports when main export path does not exist',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
              },
            },
            // Note: not creating the file
          })
          return workspace.getPath('package.json')
        })(),
        errors: [
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/index.js' },
          },
        ],
      },
      {
        name: 'reports when secondary export path does not exist',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './utils': './src/utils/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: {
              'src/index.js': '// generated for test',
            }, // Only create main export, not utils
          })
          return workspace.getPath('package.json')
        })(),
        errors: [
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/utils/index.js' },
          },
        ],
      },
      {
        name: 'reports when conditional export path does not exist',
        code: JSON.stringify(
          {
            exports: {
              '.': {
                import: './src/index.mjs',
                require: './src/index.cjs',
              },
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: {
              'src/index.mjs': '// generated for test',
            }, // Only create import, not require
          })
          return workspace.getPath('package.json')
        })(),
        errors: [
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/index.cjs' },
          },
        ],
      },
      {
        name: 'reports multiple missing export paths',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './utils': './src/utils/index.js',
              './models': './src/models/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
                './models': './src/models/index.js',
              },
            },
            // No files created
          })
          return workspace.getPath('package.json')
        })(),
        errors: [
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/index.js' },
          },
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/utils/index.js' },
          },
          {
            messageId: 'exportPathNotFound',
            data: { path: './src/models/index.js' },
          },
        ],
      },
    ],
  })
})
