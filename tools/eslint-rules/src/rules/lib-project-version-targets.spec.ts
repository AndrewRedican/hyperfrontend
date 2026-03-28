import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-project-version-targets'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

describe('lib-project-version-targets', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-project-version-targets', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify(
          {
            name: 'test',
            projectType: 'library',
            targets: { build: {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: { name: 'test', projectType: 'library', targets: { build: {} } },
          })
          return workspace.getPath('project.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify(
          {
            name: 'app-test',
            projectType: 'application',
            targets: { build: {}, publish: {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: { name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } },
          })
          return workspace.getPath('project.json')
        })(),
      },
      {
        name: 'passes when both version and version-check exist',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
            tags: ['type:util'],
            targets: { build: {}, publish: {}, version: {}, 'version-check': {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, version: {}, 'version-check': {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing version and version-check when neither exists',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
            tags: ['type:util'],
            targets: { build: {}, publish: {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingVersion' }, { messageId: 'missingVersionCheck' }],
      },
      {
        name: 'reports missing version-check when only version exists',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
            tags: ['type:util'],
            targets: { build: {}, publish: {}, version: {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, version: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingVersionCheck' }],
      },
      {
        name: 'reports missing version when only version-check exists',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
            tags: ['type:util'],
            targets: { build: {}, publish: {}, 'version-check': {} },
          },
          null,
          2
        ),
        filename: (() => {
          const workspace = manager.create({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, 'version-check': {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingVersion' }],
      },
    ],
  })
})
