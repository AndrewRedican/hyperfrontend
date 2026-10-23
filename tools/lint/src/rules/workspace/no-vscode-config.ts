/**
 * VS Code configuration has one home, `.devcontainer/devcontainer.json`, so no `.vscode`
 * directory may exist anywhere in the workspace. The check runs once, from the workspace's own
 * `package.json`.
 *
 * @module rules/workspace/no-vscode-config
 */

import type { JsonTreeNode } from '@hyperfrontend/linter'
import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { wholeDocument } from '@hyperfrontend/linter/helpers'

/** The rule's options. */
interface Options {
  /** The file that owns the configuration, named in the message. */
  readonly configFile?: string
}

/** Directories never descended into. */
const SKIPPED = ['node_modules', '.git', 'dist', 'coverage', 'tmp', 'out', '.next', '.nx', '.angular', '.verdaccio', '.claude', '_']

/**
 * Every `.vscode` directory under a root, as POSIX paths relative to it.
 *
 * @param root - The workspace root
 * @returns The paths in walk order
 */
function vscodeDirectories(root: string): string[] {
  const found: string[] = []
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.name === '.vscode') found.push(path)
      else if (!SKIPPED.includes(entry.name)) walk(join(directory, entry.name), path)
    }
  }
  walk(root, '')
  return found
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/no-vscode-config',
  language: 'json',
  fixable: false,
  create(context) {
    const directory = dirname(context.file.path)
    if (basename(context.file.path) !== 'package.json' || !existsSync(join(directory, 'nx.json'))) return {}
    const configFile = context.options?.configFile ?? '.devcontainer/devcontainer.json'
    return {
      document() {
        for (const path of vscodeDirectories(directory)) {
          context.report({
            ...wholeDocument(context.file),
            message: `VS Code configuration belongs in ${configFile} under 'customizations.vscode', so the environment has one source of truth. Found '${path}': merge what it holds into that file and delete it.`,
          })
        }
      },
    }
  },
})
