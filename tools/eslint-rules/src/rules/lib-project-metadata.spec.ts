import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-project-metadata'

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
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-project-metadata', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify({ name: 'test', projectType: 'library', targets: { build: {} } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: { name: 'test', projectType: 'library', targets: { build: {} } },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify({ name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } }, null, 2),
        filename: (() => {
          const dir = createTempProject({
            projectJson: { name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } },
          })
          return join(dir, 'project.json')
        })(),
      },
      {
        name: 'passes with all required fields',
        code: JSON.stringify(validProjectJson, null, 2),
        filename: (() => {
          const dir = createTempProject({ projectJson: validProjectJson })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: [],
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'test-library',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              projectType: 'library',
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingTags' }, { messageId: 'missingName' }, { messageId: 'missingDescription' }],
      },
    ],
  })
})
