/**
 * A backreference to a group that cannot have matched yet, or whose match is gone, always
 * matches the empty string: a reference from within its own group, to a group later in the
 * pattern, to a group before it inside a lookbehind, to a group in another alternative, or to a
 * group inside a negative lookaround.
 *
 * @module rules/javascript/no-useless-backreference
 */

import type { Node } from '../../code/model'
import type { BackreferenceNode, CapturingGroupNode, LookaroundNode, RegexNode } from '../../regex/model'
import { defineRule } from '../../engine/rule'
import { visit } from '../../regex/model'
import { parse } from '../../regex/parse'
import { scopeAnalysisOf } from '../../scope/analysis'
import { constantString, isRegExpReference } from './shared/regexp-construction'

/** Why a backreference is useless. */
type Reason = 'nested' | 'forward' | 'backward' | 'disjunctive' | 'intoNegativeLookaround'

/** A group a backreference cannot reach, with why. */
interface Problem {
  /** Why the group is out of reach. */
  readonly reason: Reason
  /** The group. */
  readonly group: CapturingGroupNode
}

/** How each reason reads in the message. */
const REASONS: Readonly<Record<Reason, string>> = {
  nested: 'from within that group',
  forward: 'which appears later in the pattern',
  backward: 'which appears before in the same lookbehind',
  disjunctive: 'which is in another alternative',
  intoNegativeLookaround: 'which is in a negative lookaround',
}

/**
 * The nodes from one up to the pattern, the node first.
 *
 * @param node - The node started from
 * @returns The nodes from the given one up to the pattern
 */
function pathToRoot(node: RegexNode): RegexNode[] {
  const path: RegexNode[] = []
  for (let current: RegexNode | null = node; current !== null; current = current.parent) path.push(current)
  return path
}

/**
 * Why a backreference cannot reach a group, when it cannot.
 *
 * @param reference - The backreference
 * @param referencePath - Its path to the pattern
 * @param group - The group it names
 * @returns The reason, or null when the group is reachable
 */
function problemOf(reference: BackreferenceNode, referencePath: readonly RegexNode[], group: CapturingGroupNode): Reason | null {
  if (referencePath.includes(group)) return 'nested'
  const groupPath = pathToRoot(group)
  let referenceIndex = referencePath.length - 1
  let groupIndex = groupPath.length - 1
  do {
    referenceIndex -= 1
    groupIndex -= 1
  } while (referencePath[referenceIndex] === groupPath[groupIndex])
  const groupSide = groupPath.slice(0, groupIndex + 1)
  const common = groupPath.slice(groupIndex + 1)
  const lookaround = common.find((node) => node.kind === 'Lookaround')
  const backward = lookaround !== undefined && (lookaround as LookaroundNode).behind
  if (!backward && reference.end <= group.start) return 'forward'
  if (backward && group.end <= reference.start) return 'backward'
  if ((groupSide[groupSide.length - 1] as RegexNode).kind === 'Alternative') return 'disjunctive'
  return groupSide.some((node) => node.kind === 'Lookaround' && node.negate) ? 'intoNegativeLookaround' : null
}

/**
 * How the groups beyond the first are counted in the message.
 *
 * @param count - How many other groups the reference names
 * @returns The phrase, empty for none
 */
function otherGroups(count: number): string {
  if (count === 0) return ''
  return count === 1 ? ' and another group' : ` and other ${count} groups`
}

export default defineRule<undefined, Node>({
  id: 'no-useless-backreference',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node, pattern: string, flags: string): void => {
      const parsed = parse(pattern, flags).pattern
      if (parsed === null) return
      visit(parsed, (item) => {
        if (item.kind !== 'Backreference') return
        const path = pathToRoot(item)
        const problems: Problem[] = []
        for (const group of item.resolved) {
          const reason = problemOf(item, path, group)
          if (reason !== null) problems.push({ reason, group })
        }
        // why: a name shared by several groups is useful as long as one of them can be reached.
        if (problems.length < item.resolved.length) return
        const [first] = problems as [Problem, ...Problem[]]
        const named = pattern.slice(first.group.start, first.group.end)
        context.report({
          start: node.start,
          end: node.end,
          message: `Backreference '${item.raw}' will be ignored. It references group '${named}'${otherGroups(problems.length - 1)} ${REASONS[first.reason]}.`,
        })
      })
    }
    const call = (node: Node): void => {
      const analysis = scopeAnalysisOf(context)
      if (!isRegExpReference(analysis, node.callee as Node)) return
      const [first, second] = node.arguments as readonly Node[]
      const pattern = first === undefined ? null : constantString(analysis, first)
      if (pattern === null) return
      check(node, pattern, second === undefined ? '' : (constantString(analysis, second) ?? ''))
    }
    return {
      Literal(node) {
        if (node.regex !== undefined) check(node, node.regex.pattern, node.regex.flags)
      },
      CallExpression: call,
      NewExpression: call,
    }
  },
})
