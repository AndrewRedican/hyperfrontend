/**
 * An import from a workspace package names the deepest entry that exports everything it
 * imports: the path aliases of `tsconfig.base.json` say which entries exist, each entry's
 * source says what it exports, and the import is rewritten to the deepest match.
 *
 * @module rules/workspace/deepest-import-path
 */

import type { Node } from '@hyperfrontend/linter'
import { dirname } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { baseConfigRootOf, pathAliases } from './shared/aliases.ts'
import { moduleExports } from './shared/exports-index.ts'

/** The rule's options. */
interface Options {
  /** The prefix of the package names checked. */
  readonly packagePrefix?: string
}

/** The prefix checked when none is configured. */
const DEFAULT_PREFIX = '@hyperfrontend/'

/**
 * The names a named import brings in by identifier, as the previous rule counted them.
 *
 * @param node - The import declaration
 * @returns The names, none for a default, namespace or side-effect import
 */
function importedNames(node: Node): string[] {
  return (node.specifiers as readonly Node[]).flatMap((specifier) =>
    specifier.kind === 'ImportSpecifier' && (specifier.imported as Node).kind === 'Identifier'
      ? [(specifier.imported as Node).name as string]
      : []
  )
}

export default defineRule<Options | undefined, Node>({
  id: 'workspace/deepest-import-path',
  language: 'code',
  fixable: true,
  create(context) {
    const root = baseConfigRootOf(dirname(context.file.path))
    if (root === null) return {}
    const prefix = context.options?.packagePrefix ?? DEFAULT_PREFIX
    const aliases = pathAliases(root)
    return {
      ImportDeclaration(node) {
        const source = node.source as Node
        const current = source.value as string
        // why: only an import of a package's main entry is pointed deeper; a subpath import already chose its entry.
        if (!current.startsWith(prefix) || current.split('/').length !== (current.startsWith('@') ? 2 : 1)) return
        const names = importedNames(node)
        if (names.length === 0) return
        const deeper = aliases
          .filter((alias) => alias.alias.startsWith(`${current}/`) && alias.source !== null)
          .sort((a, b) => b.alias.split('/').length - a.alias.split('/').length)
        const best = deeper.find((alias) => {
          const exported = moduleExports(alias.source as string).map((item) => item.name)
          return names.every((name) => exported.includes(name))
        })
        if (best === undefined) return
        const quote = context.file.text[source.start]
        context.report({
          start: source.start,
          end: source.end,
          message: `Import from '${current}' could use a more specific path: '${best.alias}'.`,
          fix: { start: source.start, end: source.end, text: `${quote}${best.alias}${quote}` },
        })
      },
    }
  },
})
