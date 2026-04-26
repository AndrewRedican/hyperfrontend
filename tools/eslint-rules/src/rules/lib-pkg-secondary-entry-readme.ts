import type { Rule } from 'eslint'
import type { JSONNode, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { basename, dirname, join } from 'node:path'
import { exists, isPublishableLibrary, readFileIfExists } from '../utils'

/**
 * Rule identifier for the lib-pkg-secondary-entry-readme rule.
 */
export const RULE_NAME = 'lib-pkg-secondary-entry-readme'

/**
 * Result of inspecting a README's first heading and description.
 */
export interface ReadmeContentCheck {
  /** True when the README has an H1 (`# `) heading whose normalized text matches the expected module name. */
  hasMatchingHeading: boolean
  /** True when a non-empty, non-heading paragraph line follows the H1. */
  hasDescription: boolean
}

/**
 * Returns the workspace-relative path where a secondary entrypoint's README is expected.
 *
 * @param projectRoot - Library root absolute or relative path (e.g., 'libs/versioning').
 * @param subpath - Secondary entrypoint subpath (no leading `./`).
 * @returns Path to the expected README, joined onto `projectRoot`.
 *
 * @example
 * getExpectedReadmePath('libs/versioning', 'commits/parse')
 * // 'libs/versioning/src/commits/parse/README.md'
 */
export function getExpectedReadmePath(projectRoot: string, subpath: string): string {
  return join(projectRoot, 'src', subpath, 'README.md')
}

/**
 * Normalizes an H1 heading text for module-name comparison.
 * Lowercases, strips trailing slash, and strips a trailing ` module` suffix.
 *
 * @param text - Raw H1 text (without the leading `# `).
 * @returns Normalized text suitable for comparison.
 */
function normalizeHeadingText(text: string): string {
  let result = text.trim().toLowerCase()
  if (result.endsWith('/')) {
    result = result.slice(0, -1)
  }
  if (result.endsWith(' module')) {
    result = result.slice(0, -' module'.length)
  }
  return result.trim()
}

/**
 * Inspects README content to determine whether it has a matching H1 and a description line.
 * The heading is matched against the basename of the subpath, case-insensitively, allowing
 * a trailing `/` and a trailing ` module` suffix. The description must be the first non-blank
 * line after the H1 and must not start with `#`.
 *
 * @param content - Full README contents.
 * @param expectedModuleName - The basename of the secondary entrypoint subpath (e.g., `parse`).
 * @returns Flags indicating heading and description presence.
 *
 * @example
 * inspectReadmeContent('# parse\n\nParses commits.\n', 'parse')
 */
export function inspectReadmeContent(content: string, expectedModuleName: string): ReadmeContentCheck {
  const lines = content.split('\n')
  const headingLine = lines.find((line) => line.startsWith('# '))

  if (headingLine === undefined) {
    return { hasMatchingHeading: false, hasDescription: false }
  }

  const hasMatchingHeading = normalizeHeadingText(headingLine.slice(2)) === expectedModuleName.toLowerCase()
  const headingIndex = lines.indexOf(headingLine)
  const firstNonBlank = lines.slice(headingIndex + 1).find((line) => line.trim().length > 0)
  const hasDescription = firstNonBlank !== undefined && !firstNonBlank.trim().startsWith('#')

  return { hasMatchingHeading, hasDescription }
}

/**
 * Extracts the property key name from a JSONProperty node.
 *
 * @param prop - The JSONProperty node.
 * @returns The key name as a string, or null if the key is not a string-valued literal/identifier.
 */
function getJsonPropertyKey(prop: JSONProperty): string | null {
  const key = prop.key
  if (key.type === 'JSONIdentifier') {
    return key.name
  }
  if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
    return key.value
  }
  return null
}

/**
 * Determines whether an export key represents a concrete secondary entrypoint subpath.
 * Excludes the primary entrypoint (`.`), the package.json self-reference, glob keys, and
 * any key that does not start with `./`.
 *
 * @param key - The exports map key.
 * @returns True when the key is a concrete secondary subpath.
 */
function isSecondaryEntryKey(key: string): boolean {
  if (key === '.' || key === './package.json') {
    return false
  }
  if (!key.startsWith('./')) {
    return false
  }
  if (key.includes('*')) {
    return false
  }
  return true
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure every secondary entrypoint declared in a publishable library package.json has a README.md with an H1 matching the module name and a description line',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-secondary-entry-readme.md',
    },
    schema: [],
    messages: {
      missingSecondaryReadme: "Secondary entrypoint './{{ subpath }}' is missing required README at {{ expectedPath }}",
      missingReadmeHeading: "Secondary entrypoint './{{ subpath }}' README at {{ expectedPath }} must start with '# {{ moduleName }}'",
      missingReadmeDescription:
        "Secondary entrypoint './{{ subpath }}' README at {{ expectedPath }} must include a description line beneath the H1",
    },
  },

  create(context) {
    const projectRoot = dirname(context.filename)

    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    return {
      JSONProperty(node: JSONNode) {
        /* istanbul ignore if -- type guard for jsonc-eslint-parser */
        if (node.type !== 'JSONProperty') {
          return
        }

        const keyName = getJsonPropertyKey(node)
        if (keyName !== 'exports') {
          return
        }

        const value = node.value
        if (value.type !== 'JSONObjectExpression') {
          return
        }

        for (const prop of value.properties) {
          /* istanbul ignore if -- type guard for jsonc-eslint-parser */
          if (prop.type !== 'JSONProperty') {
            continue
          }

          const subpathKey = getJsonPropertyKey(prop)
          if (subpathKey === null || !isSecondaryEntryKey(subpathKey)) {
            continue
          }

          const subpath = subpathKey.slice(2)
          const moduleName = basename(subpath)
          const relativeReadmePath = getExpectedReadmePath('.', subpath)
          const absoluteReadmePath = getExpectedReadmePath(projectRoot, subpath)

          if (!exists(absoluteReadmePath)) {
            context.report({
              node: prop as unknown as Rule.Node,
              messageId: 'missingSecondaryReadme',
              data: { subpath, expectedPath: relativeReadmePath },
            })
            continue
          }

          /* istanbul ignore next -- exists() above guarantees the file is readable */
          const content = readFileIfExists(absoluteReadmePath) ?? ''
          const { hasMatchingHeading, hasDescription } = inspectReadmeContent(content, moduleName)

          if (!hasMatchingHeading) {
            context.report({
              node: prop as unknown as Rule.Node,
              messageId: 'missingReadmeHeading',
              data: { subpath, expectedPath: relativeReadmePath, moduleName },
            })
            continue
          }

          if (!hasDescription) {
            context.report({
              node: prop as unknown as Rule.Node,
              messageId: 'missingReadmeDescription',
              data: { subpath, expectedPath: relativeReadmePath },
            })
          }
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
