import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-package-json-export'

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

/**
 * Publishable library project.json.
 */
const publishableProjectJson = {
  projectType: 'library',
  targets: { build: {}, publish: {} },
}

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
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-pkg-package-json-export', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: { projectType: 'library', targets: { build: {} } },
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
            projectJson: { projectType: 'application', targets: { build: {}, publish: {} } },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
        })(),
      },
      {
        name: 'passes with ./package.json export',
        code: JSON.stringify(validPackageJson, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: validPackageJson,
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: {
              exports: {
                './package.json': './package.json',
              },
            },
          })
          return join(dir, 'package.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing exports field',
        code: JSON.stringify({ name: '@hyperfrontend/test-lib' }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: { name: '@hyperfrontend/test-lib' },
          })
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports exports without ./package.json',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports empty exports object',
        code: JSON.stringify({ exports: {} }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: { exports: {} },
          })
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
      {
        name: 'reports multiple exports without ./package.json',
        code: JSON.stringify({ exports: { '.': './src/index.js', './browser': './src/browser.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: publishableProjectJson,
            packageJson: { exports: { '.': './src/index.js', './browser': './src/browser.js' } },
          })
          return join(dir, 'package.json')
        })(),
        errors: [{ messageId: 'missingPackageJsonExport' }],
      },
    ],
  })
})
