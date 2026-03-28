import { join } from 'node:path'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-e2e-project-required'

const manager = createTempWorkspaceManager()

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
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
    'libs/test-lib/project.json': JSON.stringify(config.projectJson, null, 2),
  }

  if (config.hasE2eProject) {
    files['apps/package-e2e/test-lib/project.json'] = JSON.stringify(
      {
        name: 'e2e-lib-test-lib',
        projectType: 'application',
        tags: ['type:e2e'],
        implicitDependencies: ['lib-test-lib'],
      },
      null,
      2
    )
  }

  const workspace = manager.create({ files })

  return {
    workspaceRoot: workspace.root,
    libProjectRoot: join(workspace.root, 'libs', 'test-lib'),
    e2eProjectRoot: join(workspace.root, 'apps', 'package-e2e', 'test-lib'),
  }
}

const ruleTester = createJsonRuleTester()

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
    manager.cleanupAll()
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
          const workspace = manager.create({
            files: {
              'nx.json': JSON.stringify({ version: 2 }, null, 2),
              'apps/test-app/project.json': JSON.stringify(applicationProjectJson, null, 2),
            },
          })
          return join(workspace.root, 'apps', 'test-app', 'project.json')
        })(),
      },
      {
        name: 'skips projects outside libs folder',
        code: JSON.stringify(publishableProjectJson, null, 2),
        filename: (() => {
          const workspace = manager.create({
            files: {
              'nx.json': JSON.stringify({ version: 2 }, null, 2),
              'packages/test-lib/project.json': JSON.stringify(publishableProjectJson, null, 2),
            },
          })
          return join(workspace.root, 'packages', 'test-lib', 'project.json')
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
