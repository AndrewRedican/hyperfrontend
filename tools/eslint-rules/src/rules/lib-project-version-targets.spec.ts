import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-project-version-targets'

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

describe('lib-project-version-targets', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
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
          const dir = createTempProject({
            projectJson: { name: 'test', projectType: 'library', targets: { build: {} } },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: { name: 'app-test', projectType: 'application', targets: { build: {}, publish: {} } },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, version: {}, 'version-check': {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, version: {} },
            },
          })
          return join(dir, 'project.json')
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
          const dir = createTempProject({
            projectJson: {
              name: 'lib-test',
              description: 'Test library',
              projectType: 'library',
              tags: ['type:util'],
              targets: { build: {}, publish: {}, 'version-check': {} },
            },
          })
          return join(dir, 'project.json')
        })(),
        errors: [{ messageId: 'missingVersion' }],
      },
    ],
  })
})
