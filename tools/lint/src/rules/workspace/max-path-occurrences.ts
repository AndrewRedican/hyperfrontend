/**
 * A module is imported from once per kind: one type import and one value import at most, and in
 * an index file one type export and one value export at most per source.
 *
 * @module rules/workspace/max-path-occurrences
 */

import type { Node } from '../../code/model.ts'
import { basename } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule.ts'

/** An index file's name. */
const INDEX_FILE = /^index\.[jt]sx?$/

export default defineRule<undefined, Node>({
  id: 'workspace/max-path-occurrences',
  language: 'code',
  fixable: false,
  create(context) {
    const index = INDEX_FILE.test(basename(context.file.path))
    return {
      Program(program) {
        const groups = createMap<string, Node[]>()
        for (const statement of program.body as readonly Node[]) {
          const source = statement.source as Node | null | undefined
          const exported = statement.kind === 'ExportNamedDeclaration' || statement.kind === 'ExportAllDeclaration'
          if (source === null || source === undefined || (statement.kind !== 'ImportDeclaration' && !(exported && index))) continue
          const kind = (exported ? statement.exportKind : statement.importKind) === 'type' ? 'type' : 'value'
          const key = `${kind} ${exported ? 'export' : 'import'} ${source.value as string}`
          groups.set(key, [...(groups.get(key) ?? []), statement])
        }
        for (const [key, statements] of groups) {
          if (statements.length < 2) continue
          const [kind, direction, ...rest] = key.split(' ')
          const source = rest.join(' ')
          for (const statement of statements) {
            context.report({
              start: statement.start,
              end: statement.end,
              message: `Multiple ${kind} ${direction} statements from "${source}" (${statements.length} found). Consolidate into a single ${kind} ${direction}.`,
            })
          }
        }
      },
    }
  },
})
