import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-exports-exist'

const tempDirs: string[] = []

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - Optional project.json content.
 * @param config.packageJson - Optional package.json content.
 * @param config.files - Optional array of file paths to create (relative to project root).
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object; files?: string[] }): string {
  const testDir = mkdtempSync(join(tmpdir(), 'eslint-test-'))
  tempDirs.push(testDir)

  if (config.projectJson) {
    writeFileSync(join(testDir, 'project.json'), JSON.stringify(config.projectJson, null, 2), { mode: 0o600 })
  }

  if (config.packageJson) {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(config.packageJson, null, 2), { mode: 0o600 })
  }

  mkdirSync(join(testDir, 'src'), { recursive: true })

  // Create any additional files specified
  if (config.files) {
    for (const file of config.files) {
      const filePath = join(testDir, file)
      const dirPath = join(filePath, '..')
      mkdirSync(dirPath, { recursive: true })
      writeFileSync(filePath, '// generated for test', { mode: 0o600 })
    }
  }

  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
})

describe('lib-pkg-exports-exist', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-pkg-exports-exist', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ exports: { '.': './src/index.js' } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: {
                build: {},
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
                build: {},
                publish: {},
              },
            },
            packageJson: { exports: { '.': './src/index.js' } },
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: ['src/index.js', 'src/utils/index.js'],
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './package.json': './package.json',
              },
            },
            files: ['src/index.js'],
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: ['src/index.mjs', 'src/index.cjs'],
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: ['src/index.ts', 'src/utils/index.ts'],
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: ['src/index.ts'],
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
              },
            },
            // Note: not creating the file
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
              },
            },
            files: ['src/index.js'], // Only create main export, not utils
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': {
                  import: './src/index.mjs',
                  require: './src/index.cjs',
                },
              },
            },
            files: ['src/index.mjs'], // Only create import, not require
          })
          return join(dir, 'package.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
            packageJson: {
              exports: {
                '.': './src/index.js',
                './utils': './src/utils/index.js',
                './models': './src/models/index.js',
              },
            },
            // No files created
          })
          return join(dir, 'package.json')
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
