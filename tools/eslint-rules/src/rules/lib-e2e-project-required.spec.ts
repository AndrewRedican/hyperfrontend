import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-e2e-project-required'

const tempDirs: string[] = []

/**
 * Creates a temporary workspace structure for testing.
 *
 * @param config - Configuration for the temporary workspace.
 * @param config.projectJson - The project.json content for the library.
 * @param config.hasE2eProject - Whether to create the e2e project.
 * @returns An object containing paths to the temporary workspace.
 */
function createTempWorkspace(config: { projectJson: object; hasE2eProject?: boolean }): {
  workspaceRoot: string
  libProjectRoot: string
  e2eProjectRoot: string
} {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'eslint-test-workspace-'))
  tempDirs.push(workspaceRoot)

  // Create nx.json to mark workspace root
  writeFileSync(join(workspaceRoot, 'nx.json'), JSON.stringify({ version: 2 }, null, 2), { mode: 0o600 })

  // Create libs/test-lib directory
  const libProjectRoot = join(workspaceRoot, 'libs', 'test-lib')
  mkdirSync(libProjectRoot, { recursive: true })

  // Write project.json for the library
  writeFileSync(join(libProjectRoot, 'project.json'), JSON.stringify(config.projectJson, null, 2), { mode: 0o600 })

  // Create e2e project if specified
  const e2eProjectRoot = join(workspaceRoot, 'apps', 'package-e2e', 'test-lib')
  if (config.hasE2eProject) {
    mkdirSync(e2eProjectRoot, { recursive: true })
    writeFileSync(
      join(e2eProjectRoot, 'project.json'),
      JSON.stringify(
        {
          name: 'e2e-lib-test-lib',
          projectType: 'application',
          tags: ['type:e2e'],
          implicitDependencies: ['lib-test-lib'],
        },
        null,
        2
      ),
      { mode: 0o600 }
    )
  }

  return { workspaceRoot, libProjectRoot, e2eProjectRoot }
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
})

/**
 * Valid publishable library project.json.
 */
const publishableProjectJson = {
  name: 'lib-test-lib',
  description: 'A test library',
  projectType: 'library',
  tags: ['type:util', 'scope:public'],
  targets: { build: {}, publish: {} },
}

/**
 * Non-publishable library project.json (missing publish target).
 */
const nonPublishableProjectJson = {
  name: 'lib-test-lib',
  description: 'A test library',
  projectType: 'library',
  tags: ['type:util'],
  targets: { build: {} },
}

const applicationProjectJson = {
  name: 'app-test',
  description: 'A test application',
  projectType: 'application',
  tags: ['type:app'],
  targets: { build: {} },
}

describe('lib-e2e-project-required', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('lib-e2e-project-required', rule, {
    valid: [
      {
        name: 'passes when publishable library has e2e project',
        code: JSON.stringify(publishableProjectJson, null, 2),
        filename: (() => {
          const { libProjectRoot } = createTempWorkspace({
            projectJson: publishableProjectJson,
            hasE2eProject: true,
          })
          return join(libProjectRoot, 'project.json')
        })(),
      },
      {
        name: 'skips non-publishable libraries',
        code: JSON.stringify(nonPublishableProjectJson, null, 2),
        filename: (() => {
          const { libProjectRoot } = createTempWorkspace({
            projectJson: nonPublishableProjectJson,
            hasE2eProject: false,
          })
          return join(libProjectRoot, 'project.json')
        })(),
      },
      {
        name: 'skips application projects',
        code: JSON.stringify(applicationProjectJson, null, 2),
        filename: (() => {
          const workspaceRoot = mkdtempSync(join(tmpdir(), 'eslint-test-app-'))
          tempDirs.push(workspaceRoot)

          writeFileSync(join(workspaceRoot, 'nx.json'), JSON.stringify({ version: 2 }, null, 2), { mode: 0o600 })

          const appRoot = join(workspaceRoot, 'apps', 'test-app')
          mkdirSync(appRoot, { recursive: true })
          writeFileSync(join(appRoot, 'project.json'), JSON.stringify(applicationProjectJson, null, 2), { mode: 0o600 })

          return join(appRoot, 'project.json')
        })(),
      },
      {
        name: 'skips projects outside libs folder',
        code: JSON.stringify(publishableProjectJson, null, 2),
        filename: (() => {
          const workspaceRoot = mkdtempSync(join(tmpdir(), 'eslint-test-outside-'))
          tempDirs.push(workspaceRoot)

          writeFileSync(join(workspaceRoot, 'nx.json'), JSON.stringify({ version: 2 }, null, 2), { mode: 0o600 })

          const projectRoot = join(workspaceRoot, 'packages', 'test-lib')
          mkdirSync(projectRoot, { recursive: true })
          writeFileSync(join(projectRoot, 'project.json'), JSON.stringify(publishableProjectJson, null, 2), { mode: 0o600 })

          return join(projectRoot, 'project.json')
        })(),
      },
    ],
    invalid: [
      {
        name: 'reports when publishable library is missing e2e project',
        code: JSON.stringify(publishableProjectJson, null, 2),
        filename: (() => {
          const { libProjectRoot } = createTempWorkspace({
            projectJson: publishableProjectJson,
            hasE2eProject: false,
          })
          return join(libProjectRoot, 'project.json')
        })(),
        errors: [
          {
            messageId: 'missingE2eProject',
            data: { libraryName: 'lib-test-lib', e2eFolderName: 'test-lib' },
          },
        ],
      },
    ],
  })
})
