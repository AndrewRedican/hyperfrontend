/**
 * What a rule is: an id, the language it reads, whether it fixes, and a `create` that receives
 * the file and returns listeners by node kind. A rule reports problems by offset; the engine
 * turns them into positions, applies directives and fixes, and prints.
 *
 * @module engine/rule
 */

import type { SourceComment } from '../config/directives.ts'
import type { LanguageSettings } from '../config/model.ts'
import type { LineMap } from '../text/lines.ts'
import type { Problem } from './report.ts'
import type { Listeners, TreeNode } from './traverse.ts'

/** The languages a rule can read. */
export type Language = 'code' | 'json' | 'markdown' | 'text'

/** The file a rule is running on. */
export interface RuleFile {
  /** The absolute path. */
  readonly path: string
  /** The project root the file is linted under, absolute. */
  readonly root: string
  /** The path relative to that root, POSIX. */
  readonly relativePath: string
  /** The text as linted in this pass. */
  readonly text: string
  /** The text's line map. */
  readonly lines: LineMap
  /** The comments the language found. */
  readonly comments: readonly SourceComment[]
}

/** What a rule receives. */
export interface RuleContext<Options, Node extends TreeNode> {
  /** The file. */
  readonly file: RuleFile
  /** The tree the language parsed. */
  readonly tree: Node
  /** The rule's options as configured, or undefined. */
  readonly options: Options
  /** The settings of the blocks that matched the file. */
  readonly settings: Readonly<Record<string, unknown>>
  /** How the file's text is read: module kind, globals and JSX pragma. */
  readonly language: LanguageSettings
  /** Reports a problem. */
  readonly report: (problem: Problem) => void
}

/** A rule module's default export. */
export interface RuleModule<Options = unknown, Node extends TreeNode = TreeNode> {
  /** The id configurations name, such as `workspace/no-enum`. */
  readonly id: string
  /** The language the rule reads. */
  readonly language: Language
  /** Whether the rule offers fixes. */
  readonly fixable: boolean
  /** Builds the listeners for one file. */
  readonly create: (context: RuleContext<Options, Node>) => Listeners<Node>
}

/**
 * Names a rule, for the type it gives a rule module's default export.
 *
 * @param rule - The id, language, fixability and listener factory
 * @returns The same object, typed as a rule module
 */
export function defineRule<Options, Node extends TreeNode>(rule: RuleModule<Options, Node>): RuleModule<Options, Node> {
  return rule
}
