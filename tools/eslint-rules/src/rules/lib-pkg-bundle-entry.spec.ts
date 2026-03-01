import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-bundle-entry'

const tempDirs: string[] = []

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - Optional project.json content.
 * @param config.packageJson - Optional package.json content.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object }): string {
  const testDir = mkdtempSync(join(tmpdir(), 'eslint-test-'))
  tempDirs.push(testDir)

  if (config.projectJson) {
    writeFileSync(join(testDir, 'project.json'), JSON.stringify(config.projectJson, null, 2), { mode: 0o600 })
  }

  if (config.packageJson) {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(config.packageJson, null, 2), { mode: 0o600 })
  }

  mkdirSync(join(testDir, 'src'), { recursive: true })
  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
})

describe('lib-pkg-bundle-entry', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-pkg-bundle-entry', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
              },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'application',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
        })(),
      },
      {
        name: 'skips when no bundle entries defined',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
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
          return join(dir, 'package.json')
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
          const dir = createTempProject({
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
          return join(dir, 'package.json')
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
          const dir = createTempProject({
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
          return join(dir, 'package.json')
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
          const dir = createTempProject({
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
          return join(dir, 'package.json')
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
          const dir = createTempProject({
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
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingBundleEntry', data: { entry: './node' } }],
      },
      {
        name: 'reports when no exports field exists',
        code: JSON.stringify({ name: '@hyperfrontend/test-lib' }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: {
                build: { options: { iife: { entry: './browser' } } },
                publish: {},
              },
            },
            packageJson: { name: '@hyperfrontend/test-lib' },
          })
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingBundleEntry', data: { entry: './browser' } }],
      },
    ],
  })
})
