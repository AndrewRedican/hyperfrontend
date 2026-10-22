/**
 * The main entry of a publishable library with a barrel topology re-exports every secondary
 * entry its manifest declares, by the entry's top-level directory.
 *
 * @module rules/workspace/lib-pkg-main-reexports
 */

import type { Node } from '../../code/model.ts'
import { dirname, posix, resolve } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { projectRootOf } from './shared/locate.ts'
import { isPublishableLibrary, readPackageFile } from './shared/project-file.ts'

/** The rule's options. */
export interface MainReexportsOptions {
  /** How the library's API is laid out; only a barrel is checked. */
  readonly topology?: 'barrel' | 'isomorphic' | 'fragmented'
  /** Export keys never expected in the main entry. */
  readonly exclude?: readonly string[]
}

/**
 * The file an export target names, a condition object read through `import`, `require` and
 * `default` in that order.
 *
 * @param target - The export's value
 * @returns The path, or null
 */
function targetOf(target: unknown): string | null {
  if (typeof target === 'string') return target
  const conditions = target as Readonly<Record<string, unknown>> | null
  const chosen =
    conditions === null || typeof conditions !== 'object'
      ? undefined
      : (conditions['import'] ?? conditions['require'] ?? conditions['default'])
  return typeof chosen === 'string' ? chosen : null
}

/**
 * The top-level directory of a relative specifier or export key.
 *
 * @param path - The specifier, starting with `./`
 * @returns The first segment after `./`, or the empty text
 */
function topDirectory(path: string): string {
  return path.slice(2).split(posix.sep)[0] as string
}

export default defineRule<MainReexportsOptions | undefined, Node>({
  id: 'workspace/lib-pkg-main-reexports',
  language: 'code',
  fixable: false,
  create(context) {
    if ((context.options?.topology ?? 'barrel') !== 'barrel') return {}
    const root = projectRootOf(dirname(context.file.path))
    if (root === null || !isPublishableLibrary(root)) return {}
    const exports = readPackageFile(root)?.exports
    if (exports === null || typeof exports !== 'object') return {}
    const map = exports as Readonly<Record<string, unknown>>
    const main = targetOf(map['.'])
    if (main === null || resolve(root, posix.normalize(main).replace(/\.(m?js|cjs)$/, '.ts')) !== resolve(context.file.path)) return {}
    const excluded = ['./package.json', ...(context.options?.exclude ?? [])]
    const expected = [
      ...createSet(
        keys(map)
          .filter((key) => key !== '.' && !excluded.includes(key))
          .map((key) => (key.startsWith('./') ? topDirectory(key) : (key.split('/')[0] as string)))
      ),
    ]
      .filter((directory) => directory !== '')
      .sort()
    const found = createSet<string>()
    const collect = (node: Node): void => {
      const source = (node.source as Node | null | undefined)?.value
      if (typeof source === 'string' && source.startsWith('./') && topDirectory(source) !== '') found.add(topDirectory(source))
    }
    return {
      ExportAllDeclaration: collect,
      ExportNamedDeclaration: collect,
      'Program:exit'(program) {
        for (const directory of expected) {
          if (found.has(directory)) continue
          context.report({
            start: program.start,
            end: program.end,
            message: `Main entry point is missing re-export for '${directory}'. Add 'export * from './${directory}'' to re-export all secondary entry point APIs.`,
          })
        }
      },
    }
  },
})
