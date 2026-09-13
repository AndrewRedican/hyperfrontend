import type { Rule } from 'eslint'
import type { JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { readFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { extractBadgesBlock, extractShortDescription } from './lib-readme-structure'

/**
 * Rule identifier for the lib-pkg-description rule.
 */
export const RULE_NAME = 'lib-pkg-description'

/** The document the description is read from, beside the manifest. */
const README = 'README.md'

/** The manifest field the readme's opening line is mirrored into. */
const FIELD = 'description'

/**
 * The one-line description a package readme opens with.
 *
 * Read the way the structure rule reads it: the first line of text after the
 * badges, which is the sentence the documentation site and the registry both
 * lead with.
 *
 * @param projectRoot - The package's directory.
 * @returns The line, or null when the package has no readme or the readme has no such line.
 */
export function readmeDescription(projectRoot: string): string | null {
  const content = readFileIfExists(join(projectRoot, README))
  if (content === null) {
    return null
  }
  const badges = extractBadgesBlock(content)
  if (badges === null) {
    return null
  }
  return extractShortDescription(content, badges.endLine)?.text ?? null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: "Keep a publishable library's manifest description equal to the line its README opens with",
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [],
    messages: {
      descriptionDrift:
        'The manifest description differs from the line the README opens with, which is the sentence the documentation site and the registry both lead with. Run lint with --fix to copy it in.',
    },
  },

  create(context) {
    const projectRoot = dirname(context.filename)
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }
    const expected = readmeDescription(projectRoot)
    if (expected === null) {
      return {}
    }

    return {
      JSONProperty(node: JSONProperty) {
        // why: only the manifest's own description is the readme's mirror; a nested field of the same name belongs to whatever object holds it
        if (node.parent.parent.type !== 'JSONExpressionStatement' || node.key.type !== 'JSONLiteral' || node.key.value !== FIELD) {
          return
        }
        const value = node.value
        if (value.type !== 'JSONLiteral' || value.value === expected) {
          return
        }
        context.report({
          node: value as unknown as Rule.Node,
          messageId: 'descriptionDrift',
          fix: (fixer) => fixer.replaceText(value as unknown as Rule.Node, stringify(expected)),
        })
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
