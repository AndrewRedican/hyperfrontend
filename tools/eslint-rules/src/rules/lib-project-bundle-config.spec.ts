import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-project-bundle-config'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

describe('lib-project-bundle-config', () => {
  afterAll(() => {
    manager.cleanupAll()
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
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: { build: { options: { iife: {} } } },
            },
          })
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
            projectJson: {
              projectType: 'application',
              targets: {
                build: { options: { iife: {} } },
                publish: {},
              },
            },
          })
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
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
          const workspace = manager.create({
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
          return workspace.getPath('project.json')
        })(),
        errors: [
          { messageId: 'missingGlobalName', data: { format: 'iife' } },
          { messageId: 'missingEntry', data: { format: 'umd' } },
        ],
      },
    ],
  })
})
