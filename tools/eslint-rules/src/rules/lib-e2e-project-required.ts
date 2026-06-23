import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, join } from 'node:path'
import { exists, findNxWorkspaceRoot, isPublishableLibrary } from '../utils'

/**
 * Rule identifier for the lib-e2e-project-required rule.
 */
export const RULE_NAME = 'lib-e2e-project-required'

/**
 * Checks if the project directory is within the libs folder.
 *
 * @param projectRoot - The project root directory.
 * @param workspaceRoot - The workspace root directory.
 * @returns True if the project is in the libs folder.
 */
function isInLibsFolder(projectRoot: string, workspaceRoot: string): boolean {
  const libsPath = join(workspaceRoot, 'libs')
  return projectRoot.startsWith(libsPath)
}

/**
 * Derives the e2e project folder name from the library name.
 * E.g., "lib-time-utils" → "time-utils".
 *
 * @param libraryName - The library project name (e.g., "lib-time-utils").
 * @returns The e2e folder name (e.g., "time-utils").
 */
function getE2eFolderName(libraryName: string): string {
  return libraryName.replace(/^lib-/, '')
}

/**
 * Checks if the e2e project exists for the given library name.
 *
 * @param libraryName - The library project name from project.json.
 * @param workspaceRoot - The workspace root directory.
 * @returns True if the e2e project exists.
 */
function hasE2eProject(libraryName: string, workspaceRoot: string): boolean {
  const e2eFolderName = getE2eFolderName(libraryName)
  const e2eProjectJson = join(workspaceRoot, 'apps', 'package-e2e', e2eFolderName, 'project.json')
  return exists(e2eProjectJson)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require publishable libraries to have a corresponding e2e project in apps/package-e2e',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-e2e-project-required.md',
    },
    schema: [],
    messages: {
      missingE2eProject:
        "Publishable library '{{ libraryName }}' is missing a corresponding e2e project. Expected: apps/package-e2e/{{ e2eFolderName }}/project.json",
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)
    const workspaceRoot = findNxWorkspaceRoot(projectRoot)

    /* istanbul ignore next - workspace root should always exist */
    if (!workspaceRoot) {
      return {}
    }

    if (!isInLibsFolder(projectRoot, workspaceRoot)) {
      return {}
    }

    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    let libraryName: string | null = null

    return {
      JSONProperty(node: JSONNode) {
        // istanbul ignore next -- type guard for jsonc-eslint-parser
        if (node.type !== 'JSONProperty') {
          return
        }

        const parent = node.parent
        if (parent?.type !== 'JSONObjectExpression' || parent.parent?.type !== 'JSONExpressionStatement') {
          return
        }

        const key = node.key
        let keyName: string | null = null

        if (key.type === 'JSONIdentifier') {
          keyName = key.name
        } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
          keyName = key.value
        }

        if (keyName === 'name') {
          const value = node.value
          if (value.type === 'JSONLiteral' && typeof value.value === 'string') {
            libraryName = value.value
          }
        }
      },

      'Program:exit'(node: JSONNode) {
        if (!libraryName) {
          return
        }

        if (!hasE2eProject(libraryName, workspaceRoot)) {
          const e2eFolderName = getE2eFolderName(libraryName)
          context.report({
            node: node as unknown as Rule.Node,
            messageId: 'missingE2eProject',
            data: { libraryName, e2eFolderName },
          })
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
