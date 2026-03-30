import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-project-metadata'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Valid publishable library project.json.
 */
const validProjectJson = {
  name: 'lib-test-library',
  description: 'A test library for validation',
  projectType: 'library',
  tags: ['type:util', 'scope:public'],
  targets: { build: {}, publish: {} },
}

describe('lib-project-metadata', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-project-metadata', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ name: 'test', projectType: 'library', targets: { build: {} } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: { name: 'test', projectType: 'library', targets: { build: {} } },
          })
          return workspace.getPath('project.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify({ name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } }, null, 2),
        filename: (() => {
          const workspace = manager.create({
            projectJson: { name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } },
          })
          return workspace.getPath('project.json')
        })(),
      },
      {
        name: 'passes with all required fields',
        code: JSON.stringify(validProjectJson, null, 2),
        filename: (() => {
          const workspace = manager.create({ projectJson: validProjectJson })
          return workspace.getPath('project.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports missing tags',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
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
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingTags' }],
      },
      {
        name: 'reports empty tags array',
        code: JSON.stringify(
          {
            name: 'lib-test',
            description: 'Test library',
            projectType: 'library',
            tags: [],
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
              tags: [],
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'emptyTags' }],
      },
      {
        name: 'reports missing name',
        code: JSON.stringify(
          {
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
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingName' }],
      },
      {
        name: 'reports invalid name prefix',
        code: JSON.stringify(
          {
            name: 'test-library',
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
              name: 'test-library',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'invalidNamePrefix' }],
      },
      {
        name: 'reports missing description',
        code: JSON.stringify(
          {
            name: 'lib-test',
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
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return workspace.getPath('project.json')
        })(),
        errors: [{ messageId: 'missingDescription' }],
      },
      {
        name: 'reports all missing fields',
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
        errors: [{ messageId: 'missingTags' }, { messageId: 'missingName' }, { messageId: 'missingDescription' }],
      },
    ],
  })
})
