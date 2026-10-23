/**
 * The index of the packaged rules the documentation site renders the rule catalogue from: each
 * rule's id, family, the language it reads, whether it fixes, and the presets that turn it on.
 * Run it after adding, removing or changing a rule; `src/rules/docs.spec.ts` fails while the
 * committed index differs from what it computes.
 *
 * Usage, from the package root: `node --import ../../tools/lint/src/runtime/aliases.ts scripts/rule-index.ts`
 *
 * @module scripts/rule-index
 */

import type { RuleModule, RuleSetting } from '../src/index'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { CODE_RULES, JSDOC_RULES, REACT_RULES } from '../src/presets/rule-sets'
import { PACKAGED_RULES } from '../src/rules/catalogue'

/** Where the index is written, beside the documents it indexes. */
export const RULE_INDEX = join(import.meta.dirname, '..', 'docs', 'rules', 'index.json')

/** One rule as the catalogue lists it. */
export interface RuleIndexEntry {
  /** The id a configuration names. */
  readonly id: string
  /** The family the catalogue groups it under. */
  readonly family: string
  /** The language it reads. */
  readonly language: RuleModule['language']
  /** Whether `--fix` can apply its fixes. */
  readonly fixable: boolean
  /** The presets that turn it on, each with the severity it sets. */
  readonly presets: Readonly<Record<string, 'warn' | 'error'>>
}

/** The presets, by the name they are exported under. */
const PRESETS: Readonly<Record<string, Readonly<Record<string, RuleSetting>>>> = { CODE_RULES, JSDOC_RULES, REACT_RULES }

/** The packaged rules' sources. */
const RULES = join(import.meta.dirname, '..', 'src', 'rules')

/**
 * The family a rule's id puts it in.
 *
 * @param id - The rule's id
 * @returns The prefix of a prefixed id; for a bare id, `conventions` or `core` by where its module lives
 */
function familyOf(id: string): string {
  if (id.includes('/')) return id.split('/')[0] as string
  return existsSync(join(RULES, 'conventions', `${id}.ts`)) ? 'conventions' : 'core'
}

/**
 * Computes the index from the packaged rules and presets.
 *
 * @returns One entry per rule, in id order
 *
 * @example Find the rules a preset turns on
 * ```ts
 * const index = await ruleIndex()
 * index.filter((rule) => 'REACT_RULES' in rule.presets).map((rule) => rule.id)
 * // => ['react/display-name', 'react/jsx-key', ...]
 * ```
 */
export async function ruleIndex(): Promise<RuleIndexEntry[]> {
  const index: RuleIndexEntry[] = []
  for (const [id, load] of entries(PACKAGED_RULES)) {
    const rule = (await load()).default
    const presets: Record<string, 'warn' | 'error'> = {}
    for (const [name, preset] of entries(PRESETS)) {
      const setting = preset[id]
      if (setting === undefined || setting === 'off') continue
      presets[name] = typeof setting === 'string' ? setting : setting[0]
    }
    index.push({ id, family: familyOf(id), language: rule.language, fixable: rule.fixable, presets })
  }
  return index
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(RULE_INDEX, `${stringify(await ruleIndex(), null, 2)}\n`)
}
