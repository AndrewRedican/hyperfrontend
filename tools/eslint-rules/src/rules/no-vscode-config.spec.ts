import { join } from 'node:path'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './no-vscode-config'

const manager = createTempWorkspaceManager()

/** The root manifest this rule sweeps from. */
const ROOT_PACKAGE_JSON = { name: '@hyperfrontend/monorepo', private: true }

/**
 * Creates a workspace and returns the path of its root package.json.
 *
 * @param extraFiles - Files to create beyond nx.json and the root package.json.
 * @returns Absolute path to the workspace's root package.json.
 */
function createWorkspace(extraFiles: Record<string, string> = {}): string {
  const workspace = manager.create({
    files: {
      'nx.json': JSON.stringify({ version: 2 }, null, 2),
      'package.json': JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
      ...extraFiles,
    },
  })
  return join(workspace.root, 'package.json')
}

const ruleTester = createJsonRuleTester()

describe('no-vscode-config', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('no-vscode-config', rule, {
    valid: [
      {
        name: 'accepts a workspace with no .vscode directory anywhere',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: createWorkspace({ 'apps/demo/package.json': '{}', '.devcontainer/devcontainer.json': '{}' }),
      },
      {
        name: 'skips a package.json that is not the workspace root manifest',
        code: '{}',
        filename: (() => {
          const rootManifest = createWorkspace({ 'apps/demo/package.json': '{}', 'apps/demo/.vscode/extensions.json': '{}' })
          return join(rootManifest, '..', 'apps', 'demo', 'package.json')
        })(),
      },
      {
        name: 'skips a manifest with no Nx workspace above it',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: (() => {
          const workspace = manager.create({ files: { 'package.json': JSON.stringify(ROOT_PACKAGE_JSON, null, 2) } })
          return join(workspace.root, 'package.json')
        })(),
      },
      {
        name: 'accepts a .vscode directory whose owner is explicitly allowed',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        options: [{ allowedDirectories: ['apps/demo'] }],
        filename: createWorkspace({ 'apps/demo/.vscode/extensions.json': '{}' }),
      },
      {
        name: 'accepts the root .vscode directory when the root is explicitly allowed',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        options: [{ allowedDirectories: ['.'] }],
        filename: createWorkspace({ '.vscode/settings.json': '{}' }),
      },
      {
        name: 'never descends into dependencies or build output',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: createWorkspace({
          'node_modules/some-pkg/.vscode/extensions.json': '{}',
          'dist/apps/demo/.vscode/settings.json': '{}',
          '_/scratch/.vscode/settings.json': '{}',
        }),
      },
    ],

    invalid: [
      {
        name: 'reports a nested .vscode directory',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: createWorkspace({ 'apps/demo/.vscode/extensions.json': '{}' }),
        errors: [{ messageId: 'vscodeDirectory', data: { path: 'apps/demo/.vscode', configFile: '.devcontainer/devcontainer.json' } }],
      },
      {
        name: 'reports the root .vscode directory too',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: createWorkspace({ '.vscode/settings.json': '{}' }),
        errors: [{ messageId: 'vscodeDirectory', data: { path: '.vscode', configFile: '.devcontainer/devcontainer.json' } }],
      },
      {
        name: 'reports every offender in one pass',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        filename: createWorkspace({
          'apps/one/.vscode/extensions.json': '{}',
          'apps/two/.vscode/extensions.json': '{}',
        }),
        errors: [
          { messageId: 'vscodeDirectory', data: { path: 'apps/one/.vscode', configFile: '.devcontainer/devcontainer.json' } },
          { messageId: 'vscodeDirectory', data: { path: 'apps/two/.vscode', configFile: '.devcontainer/devcontainer.json' } },
        ],
      },
      {
        name: 'names the configured owning file in the message',
        code: JSON.stringify(ROOT_PACKAGE_JSON, null, 2),
        options: [{ configFile: '.devcontainer/other.json' }],
        filename: createWorkspace({ 'apps/demo/.vscode/extensions.json': '{}' }),
        errors: [{ messageId: 'vscodeDirectory', data: { path: 'apps/demo/.vscode', configFile: '.devcontainer/other.json' } }],
      },
    ],
  })
})
