import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-project-bundle-config'

const tempDirs: string[] = []

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - The project.json content.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson: object }): string {
  const testDir = mkdtempSync(join(tmpdir(), 'eslint-test-'))
  tempDirs.push(testDir)

  writeFileSync(join(testDir, 'project.json'), JSON.stringify(config.projectJson, null, 2), { mode: 0o600 })
  mkdirSync(join(testDir, 'src'), { recursive: true })
  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
})

describe('lib-project-bundle-config', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-project-bundle-config', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: { options: { iife: {} } },
            },
          },
          null,
          2
        ),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: { options: { iife: {} } } },
            },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify(
          {
            projectType: 'application',
            targets: {
              build: { options: { iife: {} } },
              publish: {},
            },
          },
          null,
          2
        ),
        filename: (() => {
          const dir = createTempProject({
            projectJson: {
              projectType: 'application',
              targets: {
                build: { options: { iife: {} } },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'skips when no bundle config present',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: { build: {}, publish: {} },
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
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'passes with valid iife config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: { entry: '.', globalName: 'HyperfrontendTestLib' },
                },
              },
              publish: {},
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
                    iife: { entry: '.', globalName: 'HyperfrontendTestLib' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'passes with valid umd config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  umd: { entry: './browser', globalName: 'HyperfrontendBrowser' },
                },
              },
              publish: {},
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
                    umd: { entry: './browser', globalName: 'HyperfrontendBrowser' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'passes with both iife and umd valid configs',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: { entry: '.', globalName: 'HyperfrontendLib' },
                  umd: { entry: '.', globalName: 'HyperfrontendLib' },
                },
              },
              publish: {},
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
                    iife: { entry: '.', globalName: 'HyperfrontendLib' },
                    umd: { entry: '.', globalName: 'HyperfrontendLib' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing entry in iife config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: { globalName: 'HyperfrontendLib' },
                },
              },
              publish: {},
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
                    iife: { globalName: 'HyperfrontendLib' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingEntry', data: { format: 'iife' } }],
      },
      {
        name: 'reports missing globalName in iife config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: { entry: '.' },
                },
              },
              publish: {},
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
                    iife: { entry: '.' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingGlobalName', data: { format: 'iife' } }],
      },
      {
        name: 'reports missing entry in umd config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  umd: { globalName: 'HyperfrontendLib' },
                },
              },
              publish: {},
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
                    umd: { globalName: 'HyperfrontendLib' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingEntry', data: { format: 'umd' } }],
      },
      {
        name: 'reports missing globalName in umd config',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  umd: { entry: '.' },
                },
              },
              publish: {},
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
                    umd: { entry: '.' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingGlobalName', data: { format: 'umd' } }],
      },
      {
        name: 'reports both missing entry and globalName',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: {},
                },
              },
              publish: {},
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
                    iife: {},
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [
          { messageId: 'missingEntry', data: { format: 'iife' } },
          { messageId: 'missingGlobalName', data: { format: 'iife' } },
        ],
      },
      {
        name: 'reports issues in multiple bundle configs',
        code: JSON.stringify(
          {
            projectType: 'library',
            targets: {
              build: {
                options: {
                  iife: { entry: '.' },
                  umd: { globalName: 'HyperfrontendLib' },
                },
              },
              publish: {},
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
                    iife: { entry: '.' },
                    umd: { globalName: 'HyperfrontendLib' },
                  },
                },
                publish: {},
              },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [
          { messageId: 'missingGlobalName', data: { format: 'iife' } },
          { messageId: 'missingEntry', data: { format: 'umd' } },
        ],
      },
    ],
  })
})
