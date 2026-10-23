/**
 * Lints one file: parse, run every applicable rule's listeners in one traversal, drop what the
 * directives suppress, apply fixes and repeat until none applies, then answer with positions.
 *
 * @module engine/lint-file
 */

import type { Reported, RuledProblem } from '../config/directives'
import type { EffectiveConfig } from '../config/model'
import type { LineMap } from '../text/lines'
import type { LanguageAdapter } from './languages'
import type { Message, Problem } from './report'
import type { RuleModule } from './rule'
import type { Listeners, TreeNode } from './traverse'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { applyDirectives } from '../config/directives'
import { RULE_IDS } from '../rules/ids'
import { lineMap, positionAt } from '../text/lines'
import { errorText } from './error-text'
import { applyFixes } from './fix'
import { languageFor } from './languages'
import { compareMessages } from './report'
import { groupListeners, traverse } from './traverse'

/** The file to lint. */
export interface LintInput {
  /** The absolute path. */
  readonly path: string
  /** The project root, absolute. */
  readonly root: string
  /** The path relative to the root, POSIX. */
  readonly relativePath: string
  /** The text to lint. */
  readonly text: string
}

/** How to lint it. */
export interface LintOptions {
  /** The rules and settings in effect for the file. */
  readonly config: EffectiveConfig
  /** The loaded modules of those rules; a rule whose module is missing is skipped. */
  readonly rules: ReadonlyMap<string, RuleModule>
  /** Whether to apply fixes. */
  readonly fix: boolean
  /** Whether a directive's rule id names a rule; absent, the packaged rules are the ones known. */
  readonly knownRule?: (id: string) => boolean
}

/** What one file's lint produced. */
export interface LintOutcome {
  /** The problems left, in position order. */
  readonly messages: readonly Message[]
  /** The text after fixes, or null when nothing changed. */
  readonly output: string | null
}

/** What one pass over a text produced. */
interface Pass {
  /** The line map of the text linted. */
  readonly lines: LineMap
  /** The problems the directives left, or null when the text did not parse. */
  readonly kept: readonly RuledProblem[] | null
  /** The parse failure as a message, when the text did not parse. */
  readonly fatal: Message | null
}

/** How many times fixes are applied before the remaining problems are reported as they are. */
const MAX_PASSES = 10

/**
 * Lints a file.
 *
 * @param input - The path, root and text to lint
 * @param options - The rules in effect and whether to fix
 * @returns The messages and the fixed text; empty messages and no output for a file of no known language
 *
 * @example Lint one text with one rule and apply its fixes
 * ```ts
 * const config = effectiveConfig(projectConfig([{ rules: { 'no-var': 'error' } }]), 'a.ts')
 * const rules = await createRegistry().load(['no-var'])
 * const outcome = lintFile({ path: '/p/a.ts', root: '/p', relativePath: 'a.ts', text: 'var a = 1\n' }, { config, rules, fix: true })
 * outcome.output // => 'let a = 1\n'
 * ```
 */
export function lintFile(input: LintInput, options: LintOptions): LintOutcome {
  const language = languageFor(input.path)
  if (language === null) return { messages: [], output: null }
  // why: a byte order mark is not part of the text: positions are counted without it and fixed output keeps it.
  const bom = input.text.startsWith('\uFEFF') ? '\uFEFF' : ''
  let text = input.text.slice(bom.length)
  let output: string | null = null
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const result = lintOnce(language, input, text, options)
    if (result.kept === null) return { messages: result.fatal === null ? [] : [result.fatal], output }
    const fixes = options.fix ? result.kept.flatMap((entry) => (entry.problem.fix === undefined ? [] : [entry.problem.fix])) : []
    if (fixes.length === 0) return { messages: toMessages(result.kept, result.lines), output }
    text = applyFixes(text, fixes).text
    output = bom + text
  }
  const last = lintOnce(language, input, text, options)
  return { messages: last.kept === null ? (last.fatal === null ? [] : [last.fatal]) : toMessages(last.kept, last.lines), output }
}

/**
 * Parses a text and runs the rules over it once.
 *
 * @param language - The file's language
 * @param input - The file
 * @param text - The text of this pass
 * @param options - The rules in effect
 * @returns The problems the directives left, or the parse failure
 */
function lintOnce(language: LanguageAdapter<TreeNode>, input: LintInput, text: string, options: LintOptions): Pass {
  const lines = lineMap(text, language.name === 'code')
  const parsed = language.parse(text, options.config.language)
  if (parsed.tree === null) {
    const problem = { start: parsed.error.offset, end: parsed.error.offset, message: `Parsing error: ${parsed.error.message}` }
    return { lines, kept: null, fatal: toMessage(null, 2, problem, lines, true) }
  }
  const reported: Reported[] = []
  const listeners: Listeners<TreeNode>[] = []
  for (const [ruleId, setting] of options.config.rules) {
    const rule = options.rules.get(ruleId)
    if (rule === undefined || rule.language !== language.name) continue
    const created = blaming(ruleId, () =>
      rule.create({
        file: { path: input.path, root: input.root, relativePath: input.relativePath, text, lines, comments: parsed.comments },
        tree: parsed.tree,
        options: setting.options,
        settings: options.config.settings,
        language: options.config.language,
        report: (problem) => reported.push({ ruleId, severity: setting.severity, problem }),
      })
    )
    listeners.push(
      fromEntries(
        entries(created).map(([kind, listener]) => [
          kind,
          (node: TreeNode, parents: readonly TreeNode[]) => blaming(ruleId, () => listener(node, parents)),
        ])
      )
    )
  }
  traverse(parsed.tree, language.children, groupListeners(listeners))
  const known = options.knownRule ?? packagedRule
  const outcome = applyDirectives(text, lines, parsed.comments, reported, (id) => options.rules.has(id) || known(id))
  return { lines, kept: [...outcome.kept, ...outcome.reported], fatal: null }
}

/** The ids of the packaged rules, made into a set on first use. */
let packaged: Set<string> | undefined

/**
 * Whether an id names a packaged rule.
 *
 * @param id - The id a directive names
 * @returns True for a packaged rule
 */
function packagedRule(id: string): boolean {
  packaged ??= createSet(RULE_IDS)
  return packaged.has(id)
}

/**
 * Runs part of a rule, naming the rule in anything it throws.
 *
 * @param ruleId - The rule running
 * @param run - Its `create` or one of its listeners
 * @returns What `run` answered
 * @throws {Error} What `run` threw, its message prefixed with the rule id
 */
function blaming<T>(ruleId: string, run: () => T): T {
  try {
    return run()
  } catch (error) {
    throw createError(`Rule ${ruleId}: ${errorText(error)}`, { cause: error })
  }
}

/**
 * The reported problems as messages, in position order.
 *
 * @param kept - The problems the directives left
 * @param lines - Where each line of the text starts
 * @returns One entry per problem, in position order
 */
function toMessages(kept: readonly RuledProblem[], lines: LineMap): Message[] {
  return kept.map((entry) => toMessage(entry.ruleId, entry.severity, entry.problem, lines, false)).sort(compareMessages)
}

/**
 * A problem as the linter answers it.
 *
 * @param ruleId - The rule, or null for a fatal problem
 * @param severity - 1 for a warning, 2 for an error
 * @param problem - What the rule reported, with offsets
 * @param lines - Where each line of the text starts
 * @param fatal - Whether the problem stopped linting
 * @returns The message with positions
 */
function toMessage(ruleId: string | null, severity: 1 | 2, problem: Problem, lines: LineMap, fatal: boolean): Message {
  const start = problem.at ?? positionAt(lines, problem.start)
  const end = problem.at === undefined ? (problem.end === undefined ? null : positionAt(lines, problem.end)) : null
  return {
    ruleId,
    severity,
    message: problem.message,
    line: start.line,
    column: start.column,
    endLine: problem.at === undefined ? (end === null ? null : end.line) : (problem.at.endLine ?? null),
    endColumn: problem.at === undefined ? (end === null ? null : end.column) : (problem.at.endColumn ?? null),
    fatal,
    fix: problem.fix ?? null,
    suggestions: problem.suggestions ?? [],
  }
}
