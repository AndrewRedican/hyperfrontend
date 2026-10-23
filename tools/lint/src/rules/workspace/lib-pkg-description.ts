/**
 * A publishable library's manifest description equals the line its README opens with, the
 * sentence the documentation site and the registry both lead with; the fix copies it in.
 *
 * @module rules/workspace/lib-pkg-description
 */

import type { JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { JsonTreeNode, RuleContext } from '@hyperfrontend/linter'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { defineRule } from '@hyperfrontend/linter'
import { isPublishableLibrary } from './shared/project-file.ts'
import { badgeBlock, shortDescription } from './shared/readme.ts'

const MESSAGE =
  'The manifest description differs from the line the README opens with, which is the sentence the documentation site and the registry both lead with. Run lint with --fix to copy it in.'

/**
 * The description a library's README opens with.
 *
 * @param root - The library's directory
 * @returns The line, or null when the README is missing, has no badge block or opens with a heading
 */
function readmeDescription(root: string): string | null {
  let content: string
  try {
    content = readFileSync(join(root, 'README.md'), 'utf8')
  } catch {
    return null
  }
  const badges = badgeBlock(content)
  return badges === null ? null : (shortDescription(content, badges.endLine)?.text ?? null)
}

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/lib-pkg-description',
  language: 'json',
  fixable: true,
  create(context: RuleContext<undefined, JsonTreeNode>) {
    const root = dirname(context.file.path)
    if (basename(context.file.path) !== 'package.json' || !isPublishableLibrary(root)) return {}
    const expected = readmeDescription(root)
    if (expected === null) return {}
    return {
      property(node, parents) {
        const property = node as JsonPropertyNode
        const value = property.value
        // why: only the manifest's own description mirrors the readme; a nested field of the same name belongs to whatever holds it.
        if (
          parents.length !== 2 ||
          property.key.value !== 'description' ||
          value.kind === 'object' ||
          value.kind === 'array' ||
          value.value === expected
        )
          return
        context.report({
          start: value.start,
          end: value.end,
          message: MESSAGE,
          fix: { start: value.start, end: value.end, text: stringify(expected) },
        })
      },
    }
  },
})
