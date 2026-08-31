import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-pkg-bundle-entry'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

describe('lib-pkg-bundle-entry', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-bundle-entry', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
              },
            },
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
            projectJson: {
              projectType: 'application',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'skips when no bundle entries defined',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when iife entry exists in exports',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './browser': './src/browser/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './browser': './src/browser/index.js',
              },
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when umd entry exists in exports',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './node': './src/node/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { umd: { entry: './node' } } },
                publish: {},
              },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './node': './src/node/index.js',
              },
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes when both iife and umd entries exist',
        code: JSON.stringify(
          {
            exports: {
              '.': './src/index.js',
              './browser': './src/browser/index.js',
            },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: {
                build: {
                  options: {
                    iife: { entry: './browser' },
                    umd: { entry: './browser' },
                  },
                },
                publish: {},
              },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './browser': './src/browser/index.js',
              },
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing iife entry in exports',
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
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: {
              exports: { '.': './src/index.js' },
            },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingBundleEntry', data: { entry: './browser' } }],
      },
      {
        name: 'reports missing umd entry in exports',
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
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { umd: { entry: './node' } } },
                publish: {},
              },
            },
            packageJson: {
              exports: { '.': './src/index.js' },
            },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingBundleEntry', data: { entry: './node' } }],
      },
      {
        name: 'reports when no exports field exists',
        code: JSON.stringify({ name: '@hyperfrontend/test-lib' }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: { name: '@hyperfrontend/test-lib' },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingBundleEntry', data: { entry: './browser' } }],
      },
    ],
  })
})
