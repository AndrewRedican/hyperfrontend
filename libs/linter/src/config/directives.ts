/**
 * Inline directives: comments that switch rules off for a region, a line or the next line. The
 * vocabulary is `lint-disable` and `lint-enable` (block comments only), `lint-disable-line` and
 * `lint-disable-next-line`, each optionally followed by rule ids separated by commas, and
 * optionally by ` -- ` and a justification. A region starts and ends where its comment starts;
 * a line directive covers its comment's line, or the line after the comment ends. Unknown rule
 * ids, a line directive spanning lines and directives that suppressed nothing are reported.
 *
 * @module config/directives
 */

import type { Fix, Problem } from '../engine/report'
import type { LineMap } from '../text/lines'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { positionAt } from '../text/lines'

/** A comment as a language hands it to the engine. */
export interface SourceComment {
  /** The offset of the comment's first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** The comment's text without its delimiters. */
  readonly text: string
}

/** A problem with the rule that reported it, as the directives sort it. */
export interface RuledProblem {
  /** The rule id, or null for a problem no rule reported. */
  readonly ruleId: string | null
  /** 1 for a warning, 2 for an error. */
  readonly severity: 1 | 2
  /** The problem as reported. */
  readonly problem: Problem
}

/** A problem a rule reported, which the directives may suppress. */
export interface Reported extends RuledProblem {
  /** The rule id. */
  readonly ruleId: string
}

/** Which directive a comment carries. */
type Kind = 'disable' | 'enable' | 'disable-line' | 'disable-next-line'

/** A rule id named in a directive, with where its name sits. */
interface Name {
  /** The id, quotes removed. */
  readonly id: string
  /** The offset of the name as written. */
  readonly start: number
  /** The offset after it. */
  readonly end: number
}

/** A directive comment. */
interface Directive {
  /** Which directive it is. */
  readonly kind: Kind
  /** The comment carrying it. */
  readonly comment: SourceComment
  /** The rule ids named, empty for every rule. */
  readonly names: readonly Name[]
}

/** One rule, or every rule, a directive names, and whether it took effect. */
interface Unit {
  /** The directive. */
  readonly directive: Directive
  /** The rule id, or null for every rule. */
  readonly rule: string | null
  /** Whether it suppressed a problem, or for an enable, ended a disable. */
  used: boolean
}

/** What the directives leave and what they report about themselves. */
export interface DirectiveOutcome<T extends Reported> {
  /** The problems no directive suppressed. */
  readonly kept: T[]
  /** The problems the directives themselves raise. */
  readonly reported: RuledProblem[]
}

/** The directive word after `lint-`, at the start of a comment. */
const DIRECTIVE = /^lint-(disable-next-line|disable-line|disable|enable)(?:\s|$)/

/** Where a justification starts: two or more dashes between whitespace. */
const JUSTIFICATION = /\s-{2,}\s/

/**
 * Applies a file's directives to the problems its rules reported.
 *
 * @param text - The file's text
 * @param lines - Where each line starts
 * @param comments - The file's comments, in source order
 * @param problems - The problems the rules reported
 * @param isKnown - Whether a rule id names a rule
 * @returns The problems left and those the directives raise
 *
 * @example Drop what a disable comment covers
 * ```ts
 * const text = 'debugger // lint-disable-line no-debugger\n'
 * const outcome = applyDirectives(text, lineMap(text), comments, reported, (id) => id === 'no-debugger')
 * outcome.kept // => [], the report on line 1 is suppressed
 * ```
 */
export function applyDirectives<T extends Reported>(
  text: string,
  lines: LineMap,
  comments: readonly SourceComment[],
  problems: readonly T[],
  isKnown: (id: string) => boolean
): DirectiveOutcome<T> {
  const reported: RuledProblem[] = []
  const units: Unit[] = []
  for (const comment of comments) {
    const directive = parseComment(text, comment)
    if (directive === null) continue
    if (directive.kind === 'disable-line' && positionAt(lines, comment.start).line !== positionAt(lines, comment.end).line) {
      reported.push(directiveProblem(2, null, comment, 'lint-disable-line comment should not span multiple lines.'))
      continue
    }
    const known = directive.names.filter((name) => isKnown(name.id))
    for (const name of directive.names) {
      if (!isKnown(name.id)) reported.push(directiveProblem(2, name.id, comment, `Definition for rule '${name.id}' was not found.`))
    }
    if (directive.names.length > 0 && known.length === 0) continue
    const named = { ...directive, names: known }
    if (known.length === 0) units.push({ directive: named, rule: null, used: false })
    for (const name of known) units.push({ directive: named, rule: name.id, used: false })
  }
  const afterRegions = applyRegions(units, problems)
  const kept = applyLines(lines, units, afterRegions)
  return { kept, reported: [...reported, ...unusedProblems(units)] }
}

/**
 * The directive a comment carries.
 *
 * @param text - The file's text
 * @param comment - A comment of that file, delimiters excluded from its text
 * @returns The directive, or null for a plain comment
 */
function parseComment(text: string, comment: SourceComment): Directive | null {
  const cut = JUSTIFICATION.exec(comment.text)
  const head = cut === null ? comment.text : comment.text.slice(0, cut.index)
  const body = head.trimStart()
  const match = DIRECTIVE.exec(body)
  if (match === null) return null
  const kind = match[1] as Kind
  if ((kind === 'disable' || kind === 'enable') && text.startsWith('//', comment.start)) return null
  const listStart = text.indexOf(comment.text, comment.start) + head.length - body.length + match[0].length
  return { kind, comment, names: namesIn(body.slice(match[0].length), listStart) }
}

/**
 * The rule ids of a comma-separated list, with their offsets.
 *
 * @param list - The list as written
 * @param offset - Where it starts in the file
 * @returns The non-empty names in order
 */
function namesIn(list: string, offset: number): Name[] {
  const names: Name[] = []
  let at = offset
  for (const part of list.split(',')) {
    const name = part.trim()
    const start = at + part.indexOf(name)
    at += part.length + 1
    // why: the pattern matches every string, at worst with no quote captured.
    const id = (/^(['"]?)(.*)\1$/s.exec(name) as RegExpExecArray)[2] as string
    if (id !== '') names.push({ id, start, end: start + name.length })
  }
  return names
}

/**
 * Applies the disable and enable regions, in source order, to the problems.
 *
 * @param units - Every directive's units; those of regions are marked when used
 * @param problems - What the rules reported
 * @returns The problems no region suppressed
 */
function applyRegions<T extends Reported>(units: readonly Unit[], problems: readonly T[]): T[] {
  const regions = units.filter((unit) => unit.directive.kind === 'disable' || unit.directive.kind === 'enable')
  const ordered = [...problems].sort((left, right) => left.problem.start - right.problem.start)
  const kept: T[] = []
  let all: Unit | null = null
  const disabled = createMap<string, Unit>()
  const reenabled = createSet<string>()
  let next = 0
  const step = (unit: Unit): void => {
    if (unit.directive.kind === 'disable') {
      if (unit.rule === null) {
        all = unit
        disabled.clear()
        reenabled.clear()
      } else {
        reenabled.delete(unit.rule)
        disabled.set(unit.rule, unit)
      }
    } else if (unit.rule === null) {
      unit.used = all !== null || disabled.size > 0
      all = null
      disabled.clear()
    } else {
      unit.used = all !== null || disabled.has(unit.rule)
      if (all !== null) reenabled.add(unit.rule)
      disabled.delete(unit.rule)
    }
  }
  for (const entry of ordered) {
    while (next < regions.length && (regions[next] as Unit).directive.comment.start <= entry.problem.start) step(regions[next++] as Unit)
    const rule = entry.ruleId
    const by = disabled.get(rule) ?? (all !== null && !reenabled.has(rule) ? all : null)
    if (by === null) kept.push(entry)
    else by.used = true
  }
  while (next < regions.length) step(regions[next++] as Unit)
  return kept
}

/**
 * Applies the line directives to the problems the regions left, the latest directive for a line
 * taking the credit.
 *
 * @param lines - Where each line starts
 * @param units - Every directive's units; those of line directives are marked when used
 * @param problems - The problems left
 * @returns The problems no line directive suppressed
 */
function applyLines<T extends Reported>(lines: LineMap, units: readonly Unit[], problems: readonly T[]): T[] {
  const lineUnits = units
    .filter((unit) => unit.directive.kind === 'disable-line' || unit.directive.kind === 'disable-next-line')
    .map((unit) => {
      const { comment, kind } = unit.directive
      return { unit, line: kind === 'disable-line' ? positionAt(lines, comment.start).line : positionAt(lines, comment.end).line + 1 }
    })
    .reverse()
  return problems.filter((entry) => {
    const line = positionAt(lines, entry.problem.start).line
    const by = lineUnits.find(
      (candidate) => candidate.line === line && (candidate.unit.rule === null || candidate.unit.rule === entry.ruleId)
    )
    if (by === undefined) return true
    by.unit.used = true
    return false
  })
}

/**
 * The warnings for directives that took no effect: one for a comment none of whose rules did,
 * removing the comment, or one per rule that did not, removing its name from the list.
 *
 * @param units - Every directive's units, marked
 * @returns The warnings in source order
 */
function unusedProblems(units: readonly Unit[]): RuledProblem[] {
  const byDirective = createMap<Directive, Unit[]>()
  for (const unit of units) byDirective.set(unit.directive, [...(byDirective.get(unit.directive) ?? []), unit])
  const problems: RuledProblem[] = []
  for (const [directive, own] of byDirective) {
    const unused = own.filter((unit) => !unit.used)
    if (unused.length === 0) continue
    const { comment, names } = directive
    if (unused.length === own.length) {
      const fix = { start: comment.start, end: comment.end, text: ' ' }
      problems.push(
        directiveProblem(
          1,
          null,
          comment,
          unusedMessage(
            directive.kind,
            names.map((name) => name.id)
          ),
          fix
        )
      )
      continue
    }
    for (const unit of unused) {
      const index = names.findIndex((name) => name.id === unit.rule)
      const name = names[index] as Name
      const following = names[index + 1]
      const fix =
        following === undefined
          ? { start: (names[index - 1] as Name).end, end: name.end, text: '' }
          : { start: name.start, end: following.start, text: '' }
      problems.push(directiveProblem(1, null, comment, unusedMessage(directive.kind, [name.id]), fix))
    }
  }
  return problems
}

/**
 * The text of an unused directive's warning.
 *
 * @param kind - The directive
 * @param ids - The rule ids that took no effect, empty for every rule
 * @returns The warning's text, naming the rules that took no effect
 */
function unusedMessage(kind: Kind, ids: readonly string[]): string {
  const quoted = ids.map((id) => `'${id}'`)
  const list = quoted.length < 3 ? quoted.join(' or ') : `${quoted.slice(0, -1).join(', ')}, or ${quoted[quoted.length - 1]}`
  if (kind === 'enable') {
    return `Unused lint-enable directive (no matching lint-disable directives were found${ids.length === 0 ? '' : ` for ${list}`}).`
  }
  return `Unused lint-disable directive (no problems were reported${ids.length === 0 ? '' : ` from ${list}`}).`
}

/**
 * A problem a directive raises about itself, at its comment.
 *
 * @param severity - 1 for a warning, 2 for an error
 * @param ruleId - The rule it is filed under, or null
 * @param comment - Where the problem is placed: its start, and its end unless a fix is given
 * @param message - The text
 * @param fix - The fix, for an unused directive
 * @returns The problem; an unused directive's names only where its comment starts
 */
function directiveProblem(severity: 1 | 2, ruleId: string | null, comment: SourceComment, message: string, fix?: Fix): RuledProblem {
  const problem: Problem = fix === undefined ? { start: comment.start, end: comment.end, message } : { start: comment.start, message, fix }
  return { ruleId, severity, problem }
}
