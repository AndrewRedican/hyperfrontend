/**
 * Where a rule lives: `rules/<family>/<name>.ts` under `src/`, the family being the part of the
 * id before the slash, or `javascript` for an id without one. A module is imported on first use
 * and kept.
 *
 * @module engine/registry
 */

import type { RuleModule } from './rule.ts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { errorText } from './error-text.ts'

const loaded = createMap<string, Promise<RuleModule>>()

/**
 * The file a rule id names.
 *
 * @param id - A rule id such as `workspace/no-enum` or `no-var`
 * @returns The absolute path of its module
 */
export function rulePath(id: string): string {
  const slash = id.indexOf('/')
  const family = slash === -1 ? 'javascript' : id.slice(0, slash)
  const name = slash === -1 ? id : id.slice(slash + 1)
  return resolve(import.meta.dirname, '..', 'rules', family, `${name}.ts`)
}

/**
 * Whether an id names a rule this linter has: a family and a name, or a bare name for a core
 * rule, whose module exists.
 *
 * @param id - The id as written, for instance in a directive
 * @returns Whether a rule module answers to it
 */
export function isKnownRule(id: string): boolean {
  const parts = id.split('/')
  const valid = parts.length === 1 || (parts.length === 2 && parts[0] !== 'javascript')
  return valid && parts.every((part) => /^[a-z0-9-]+$/.test(part)) && existsSync(rulePath(id))
}

/**
 * Loads the modules of the given rules together, each once per process.
 *
 * @param ids - Rule ids, duplicates allowed
 * @returns The modules by id
 * @throws {Error} When an id names no module
 */
export async function loadRules(ids: readonly string[]): Promise<Map<string, RuleModule>> {
  const unique = [...createSet(ids)]
  const modules = await promiseAll(
    unique.map((id) => {
      let pending = loaded.get(id)
      if (pending === undefined) {
        pending = importRule(id)
        loaded.set(id, pending)
      }
      return pending
    })
  )
  return createMap(unique.map((id, index) => [id, modules[index] as RuleModule]))
}

/** A rule module as `import()` returns it. */
interface RuleModuleExports {
  /** The rule. */
  readonly default: RuleModule
}

/**
 * Imports one rule module.
 *
 * @param id - Which rule to import
 * @returns The module's default export
 * @throws {Error} When the module cannot be imported
 */
async function importRule(id: string): Promise<RuleModule> {
  const path = rulePath(id)
  try {
    return ((await import(pathToFileURL(path).href)) as RuleModuleExports).default
  } catch (error) {
    throw createError(`Rule ${id} not found at ${path}: ${errorText(error)}`)
  }
}
