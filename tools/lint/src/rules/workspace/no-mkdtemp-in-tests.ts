/**
 * Specs and their `__test-utils__` modules create temporary directories through
 * `@hyperfrontend/testing/fs` rather than `mkdtemp`: `createTempDir` and `useTempDir` resolve the
 * directory's real path, write a declared tree into it and remove it, retrying while Windows still
 * holds a handle open. A named `mkdtemp` or `mkdtempSync` import from an fs module is reported, as
 * is either name read off a namespace or default import of one; such an import used for anything
 * else is left alone.
 *
 * @module rules/workspace/no-mkdtemp-in-tests
 */

import type { Node } from '@hyperfrontend/linter'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'

/** The module paths that export `mkdtemp`. */
const FS_MODULES = createSet(['node:fs', 'fs', 'node:fs/promises', 'fs/promises'])

/** The functions that create a temporary directory. */
const MKDTEMP = createSet(['mkdtemp', 'mkdtempSync'])

/**
 * The name a member expression reads, whether dotted or bracketed with a string literal.
 *
 * @param node - The member expression
 * @returns The name, or undefined for a computed key that is not a string literal
 */
function memberName(node: Node): string | undefined {
  const property = node.property as Node
  if (!node.computed) return property.name as string
  return property.kind === 'Literal' && typeof property.value === 'string' ? property.value : undefined
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-mkdtemp-in-tests',
  language: 'code',
  fixable: false,
  create(context) {
    const modules = createSet<string>()
    const report = (node: Node, name: string): void =>
      context.report({
        start: node.start,
        end: node.end,
        message: `Create a test's temporary directory with createTempDir or useTempDir from '@hyperfrontend/testing/fs' rather than '${name}': they resolve its real path and remove it for you.`,
      })
    return {
      ImportDeclaration(node) {
        if (!FS_MODULES.has((node.source as Node).value as string)) return
        for (const specifier of node.specifiers as readonly Node[]) {
          if (specifier.kind !== 'ImportSpecifier') {
            modules.add((specifier.local as Node).name as string)
            continue
          }
          const imported = specifier.imported as Node
          const name = (imported.name ?? imported.value) as string
          if (MKDTEMP.has(name)) report(specifier, name)
        }
      },
      MemberExpression(node) {
        const object = node.object as Node
        if (object.kind !== 'Identifier' || !modules.has(object.name as string)) return
        const name = memberName(node)
        if (name !== undefined && MKDTEMP.has(name)) report(node, name)
      },
    }
  },
})
