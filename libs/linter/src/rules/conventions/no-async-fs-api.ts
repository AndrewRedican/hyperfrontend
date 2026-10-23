/**
 * File system access is synchronous: nothing is imported from `fs/promises`, and no `fs` method
 * that has a synchronous twin is imported or called through a namespace.
 *
 * @module rules/conventions/no-async-fs-api
 */

import type { Node } from '../../code/model'
import fs from 'node:fs'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The `fs` methods that have a synchronous twin, read off Node's own module. */
const ASYNC_METHODS = createSet(keys(fs).flatMap((name) => (name.endsWith('Sync') && name.slice(0, -4) in fs ? [name.slice(0, -4)] : [])))

/** The modules of the synchronous API. */
const FS_MODULES = createSet(['fs', 'node:fs'])

/** The modules of the promise API. */
const PROMISE_MODULES = createSet(['fs/promises', 'node:fs/promises'])

/**
 * The message for an import of the promise API.
 *
 * @param source - The module imported
 * @returns The report for an import of the promises API
 */
const promisesMessage = (source: string): string => `Avoid importing from '${source}'. Use synchronous fs methods from 'node:fs' instead.`

export default defineRule<undefined, Node>({
  id: 'no-async-fs-api',
  language: 'code',
  fixable: false,
  create(context) {
    const namespaces = createSet<string>()
    return {
      ImportDeclaration(node) {
        const source = node.source as Node
        const module = source.value as string
        if (PROMISE_MODULES.has(module)) {
          context.report({ start: source.start, end: source.end, message: promisesMessage(module) })
          return
        }
        if (!FS_MODULES.has(module)) return
        for (const specifier of node.specifiers as readonly Node[]) {
          if (specifier.kind !== 'ImportSpecifier') {
            namespaces.add((specifier.local as Node).name as string)
            continue
          }
          const imported = specifier.imported as Node
          const name = (imported.kind === 'Identifier' ? imported.name : imported.value) as string
          if (!ASYNC_METHODS.has(name)) continue
          context.report({
            start: specifier.start,
            end: specifier.end,
            message: `Avoid using async fs method '${name}'. Use '${name}Sync' instead for synchronous file operations.`,
          })
        }
      },
      MemberExpression(node) {
        const object = node.object as Node
        const property = node.property as Node
        if (object.kind !== 'Identifier' || !namespaces.has(object.name as string)) return
        const name = node.computed === true ? (property.kind === 'Literal' ? property.value : null) : property.name
        if (typeof name !== 'string' || !ASYNC_METHODS.has(name)) return
        context.report({
          start: node.start,
          end: node.end,
          message: `Avoid using async fs methods via namespace. Use synchronous method '${name}Sync' instead of '${name}'.`,
        })
      },
      CallExpression(node) {
        const callee = node.callee as Node
        const argument = (node.arguments as readonly Node[])[0]
        if (callee.kind !== 'Identifier' || callee.name !== 'require' || argument?.kind !== 'Literal') return
        if (typeof argument.value === 'string' && PROMISE_MODULES.has(argument.value)) {
          context.report({ start: node.start, end: node.end, message: promisesMessage(argument.value) })
        }
      },
    }
  },
})
