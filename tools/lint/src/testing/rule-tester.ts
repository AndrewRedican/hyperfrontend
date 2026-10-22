/**
 * How a rule is specified: valid texts that must report nothing, invalid texts with the messages
 * and positions they must report and, when the rule fixes, the text they must become. Each case
 * is one test with one assertion over the whole outcome.
 *
 * @module testing/rule-tester
 */

import type { LanguageSettings } from '../config/model.ts'
import type { RuleModule } from '../engine/rule.ts'
import { dirname, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../config/model.ts'
import { lintFile } from '../engine/lint-file.ts'

/** A text the rule reads. */
export interface RuleCase {
  /** The test's name. */
  readonly name: string
  /** The absolute path the text is linted as; its directory is the project root unless `root` says otherwise. */
  readonly path: string
  /** The project root, absolute, when it is not the file's directory. */
  readonly root?: string
  /** The text. */
  readonly text: string
  /** The rule's options. */
  readonly options?: unknown
  /** The settings. */
  readonly settings?: Readonly<Record<string, unknown>>
  /** How the text is read, where it differs from the default. */
  readonly language?: Partial<LanguageSettings>
}

/** A message the rule must report. */
export interface ExpectedError {
  /** The text shown to the user. */
  readonly message: string
  /** The 1-based start line, or null for a problem about the file as a whole. */
  readonly line: number | null
  /** The 1-based start column, or null for a problem about the file as a whole. */
  readonly column: number | null
  /** The 1-based end line, when checked; null for a problem without a range. */
  readonly endLine?: number | null
  /** The 1-based end column, when checked; null for a problem without a range. */
  readonly endColumn?: number | null
}

/** A text the rule must report on. */
export interface InvalidCase extends RuleCase {
  /** The messages, in position order. */
  readonly errors: readonly ExpectedError[]
  /** The text after the rule's fixes when it fixes, null when it must offer no fix; unchecked when absent. */
  readonly output?: string | null
}

/** The cases of one rule. */
export interface RuleCases {
  /** Texts that must report nothing. */
  readonly valid: readonly RuleCase[]
  /** Texts that must report. */
  readonly invalid: readonly InvalidCase[]
}

/** What linting a case produced. */
interface Outcome {
  /** The messages, shaped like expected errors. */
  readonly errors: readonly ExpectedError[]
  /** The text after fixes, or null. */
  readonly output: string | null
}

/**
 * Declares the tests of a rule.
 *
 * @param rule - The rule under test
 * @param cases - Its valid and invalid cases
 */
export function testRule(rule: RuleModule, cases: RuleCases): void {
  describe(rule.id, () => {
    for (const valid of cases.valid) {
      it(`accepts ${valid.name}`, () => {
        expect(outcome(rule, valid, false).errors).toEqual([])
      })
    }
    for (const invalid of cases.invalid) {
      it(`reports ${invalid.name}`, () => {
        expect({
          errors: outcome(rule, invalid, false).errors,
          output: invalid.output === undefined ? null : outcome(rule, invalid, true).output,
        }).toEqual({
          errors: invalid.errors.map(withOptionalEnd),
          output: invalid.output ?? null,
        })
      })
    }
  })
}

/**
 * Lints a case with the rule alone.
 *
 * @param rule - The rule under test
 * @param ruleCase - The text and path to lint
 * @param fix - Whether to apply fixes
 * @returns The messages, shaped like expected errors, and the output
 */
function outcome(rule: RuleModule, ruleCase: RuleCase, fix: boolean): Outcome {
  const root = ruleCase.root ?? dirname(ruleCase.path)
  const result = lintFile(
    { path: ruleCase.path, root, relativePath: relative(root, ruleCase.path).split(sep).join(posix.sep), text: ruleCase.text },
    {
      config: {
        rules: createMap([[rule.id, { severity: 2, options: ruleCase.options }]]),
        settings: ruleCase.settings ?? {},
        language: { ...DEFAULT_LANGUAGE, ...ruleCase.language },
      },
      rules: createMap([[rule.id, rule]]),
      fix,
    }
  )
  return {
    errors: result.messages.map((message) => ({
      message: message.message,
      line: message.line,
      column: message.column,
      endLine: message.endLine,
      endColumn: message.endColumn,
    })),
    output: result.output,
  }
}

/**
 * An expected error with its end position present, so that one not given matches any.
 *
 * @param error - The error as the spec wrote it
 * @returns The error with `expect.any(Number)` for an end position left out
 */
function withOptionalEnd(error: ExpectedError): ExpectedError {
  return {
    ...error,
    endLine: error.endLine === undefined ? (expect.any(Number) as unknown as number) : error.endLine,
    endColumn: error.endColumn === undefined ? (expect.any(Number) as unknown as number) : error.endColumn,
  }
}
