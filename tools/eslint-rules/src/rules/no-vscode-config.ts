import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, join } from 'node:path'
import { findNxWorkspaceRoot, isDirectory, readDirectory } from '../utils'

/**
 * Rule identifier for the no-vscode-config rule.
 */
export const RULE_NAME = 'no-vscode-config'

/**
 * Configuration options for the no-vscode-config rule.
 */
export interface RuleOptions {
  /** Workspace-relative directories permitted to hold a `.vscode` folder. */
  allowedDirectories?: string[]
  /** Workspace-relative file that owns VS Code configuration instead, named in the message. */
  configFile?: string
}

/** The directory name this rule exists to keep out of the tree. */
const VSCODE_DIRECTORY = '.vscode'

/** Where VS Code configuration lives instead, unless configured otherwise. */
const DEFAULT_CONFIG_FILE = '.devcontainer/devcontainer.json'

/**
 * Directory names never descended into: dependencies, build output, caches, and
 * the scratch trees that hold symlinks out of the repository.
 */
const UNWALKED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'tmp',
  'out',
  '.next',
  '.nx',
  '.angular',
  '.verdaccio',
  '.claude',
  '_',
]

/**
 * Lists every `.vscode` directory in the workspace, as workspace-relative paths.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns Workspace-relative paths of each `.vscode` directory found.
 */
function findVscodeDirectories(workspaceRoot: string): string[] {
  const found: string[] = []

  const walk = (directory: string, prefix: string): void => {
    for (const entry of readDirectory(directory)) {
      const absolute = join(directory, entry)
      if (!isDirectory(absolute)) {
        continue
      }
      const relative = prefix === '' ? entry : `${prefix}/${entry}`
      if (entry === VSCODE_DIRECTORY) {
        found.push(relative)
        continue
      }
      if (UNWALKED_DIRECTORIES.includes(entry)) {
        continue
      }
      walk(absolute, relative)
    }
  }

  walk(workspaceRoot, '')
  return found
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep VS Code configuration in the devcontainer rather than in .vscode directories',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/no-vscode-config.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedDirectories: { type: 'array', items: { type: 'string' } },
          configFile: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      vscodeDirectory:
        "VS Code configuration belongs in {{configFile}} under 'customizations.vscode', so the environment has one source of truth. Found '{{path}}': merge what it holds into that file and delete it.",
    },
  },

  create(context) {
    const directory = dirname(context.filename)
    const workspaceRoot = findNxWorkspaceRoot(directory)

    // why: the sweep covers the whole workspace, so it runs once from the root manifest rather than once per project.
    if (workspaceRoot === null || workspaceRoot !== directory) {
      return {}
    }

    const options = <RuleOptions>(context.options[0] ?? {})
    const allowed = options.allowedDirectories ?? []
    const configFile = options.configFile ?? DEFAULT_CONFIG_FILE

    return <Rule.RuleListener>(<unknown>{
      'Program:exit'(node: JSONNode) {
        for (const path of findVscodeDirectories(workspaceRoot)) {
          const owner = path === VSCODE_DIRECTORY ? '.' : dirname(path)
          if (allowed.includes(owner)) {
            continue
          }
          context.report({
            node: <Rule.Node>(<unknown>node),
            messageId: 'vscodeDirectory',
            data: { path, configFile },
          })
        }
      },
    })
  },
}

export default rule
