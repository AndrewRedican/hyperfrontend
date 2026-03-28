import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-package-json-export'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Valid package.json with ./package.json export.
 */
const validPackageJson = {
  name: '@hyperfrontend/test-lib',
  exports: {
    '.': './src/index.js',
    './package.json': './package.json',
  },
}

describe('lib-pkg-package-json-export', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-package-json-export', rule, {
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
            projectJson: { projectType: 'application', targets: { build: {}, publish: {} } },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes with ./package.json export',
        code: JSON.stringify(validPackageJson, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: validPackageJson,
          })
          return workspace.getPath('package.json')
        })(),
      },
      {
        name: 'passes with only ./package.json export',
        code: JSON.stringify(
          {
            exports: {
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
                './package.json': './package.json',
              },
            },
          })
          return workspace.getPath('package.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing exports field',
        code: JSON.stringify({ name: '@hyperfrontend/test-lib' }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/test-lib' },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports exports without ./package.json',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports empty exports object',
        code: JSON.stringify({ exports: {} }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: { exports: {} },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports multiple exports without ./package.json',
        code: JSON.stringify({ exports: { '.': './src/index.js', './browser': './src/browser.js' } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
            packageJson: { exports: { '.': './src/index.js', './browser': './src/browser.js' } },
          })
          return workspace.getPath('package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
    ],
  })
})
