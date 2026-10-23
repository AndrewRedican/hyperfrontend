/**
 * Which rules a configuration can name: the packaged rules under their ids, and the families a
 * configuration registers, each a prefix and the rules under it. A rule module is loaded on
 * first use and kept.
 *
 * @module engine/registry
 */

import type { RuleModule } from './rule'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { PACKAGED_RULES } from '../rules/catalogue'
import { errorText } from './error-text'

/** A rule module as `import()` returns it. */
export interface RuleModuleExports {
  /** The rule. */
  readonly default: RuleModule
}

/** A rule, or a function that imports the module whose default export is the rule. */
export type RuleSource = RuleModule | (() => Promise<RuleModule | RuleModuleExports>)

/** A family's rules by name; a rule's id is the family's prefix, a slash and the name. */
export type RuleFamily = Readonly<Record<string, RuleSource>>

/** The prefixes the packaged rules use, which no configuration may register again. */
const PACKAGED_FAMILIES = createSet(['typescript', 'jsdoc', 'react', 'react-hooks', 'package-json'])

/** The rules a configuration can name. */
export interface Registry {
  /**
   * Whether an id names a rule this registry has.
   *
   * @param id - The id as written, for instance in a directive
   * @returns True when a rule answers to it
   */
  has(id: string): boolean
  /**
   * Loads the modules of the given rules together, each once.
   *
   * @param ids - Rule ids, duplicates allowed
   * @returns The modules by id
   * @throws {Error} When an id names no rule or its module cannot be loaded
   */
  load(ids: readonly string[]): Promise<Map<string, RuleModule>>
}

/**
 * A registry of the packaged rules and the given families.
 *
 * @param families - Rules beyond the packaged ones, each set under the prefix its ids start with
 * @returns What the configuration's rule ids can name, each module loaded on first use
 * @throws {Error} When a prefix is not a single lowercase segment or is one the packaged rules use
 *
 * @example Add a family of local rules to the packaged ones
 * ```ts
 * const registry = createRegistry({ local: { 'no-todo': noTodo } })
 * registry.has('local/no-todo') // => true
 * const rules = await registry.load(['no-var', 'local/no-todo'])
 * ```
 */
export function createRegistry(families: Readonly<Record<string, RuleFamily>> = {}): Registry {
  const sources = createMap<string, RuleSource>(entries(PACKAGED_RULES))
  for (const [prefix, family] of entries(families)) {
    if (!/^[a-z0-9-]+$/.test(prefix) || PACKAGED_FAMILIES.has(prefix)) {
      throw createError(
        `The rule family ${prefix} cannot be registered: a prefix is lowercase letters, digits and dashes, and not one of the packaged families`
      )
    }
    for (const [name, source] of entries(family)) sources.set(`${prefix}/${name}`, source)
  }
  const loaded = createMap<string, Promise<RuleModule>>()
  return {
    has: (id) => sources.has(id),
    load: async (ids) => {
      const unique = [...createSet(ids)]
      const modules = await promiseAll(
        unique.map((id) => {
          let pending = loaded.get(id)
          if (pending === undefined) {
            pending = resolveRule(id, sources.get(id))
            loaded.set(id, pending)
          }
          return pending
        })
      )
      return createMap(unique.map((id, index) => [id, modules[index] as RuleModule]))
    },
  }
}

/**
 * Turns a rule's source into its module.
 *
 * @param id - The id the configuration names, for the error messages
 * @param source - The module or loader registered under that id, or undefined when nothing is
 * @returns The rule module, its loader called if it has one
 * @throws {Error} When the id names no rule or its module cannot be loaded
 */
async function resolveRule(id: string, source: RuleSource | undefined): Promise<RuleModule> {
  if (source === undefined) throw createError(`Definition for rule ${id} was not found`)
  if (typeof source !== 'function') return source
  try {
    const module = await source()
    return 'default' in module ? module.default : module
  } catch (error) {
    throw createError(`Rule ${id} could not be loaded: ${errorText(error)}`)
  }
}
