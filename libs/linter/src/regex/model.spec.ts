import type { RegexNode } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf, visit } from './model'
import { parse } from './parse'

/**
 * The kinds met on a walk of a pattern, in order.
 *
 * @param pattern - The pattern walked
 * @param flags - Its flags
 * @returns The kinds of every node, in visiting order
 */
function kinds(pattern: string, flags: string): string[] {
  const found: string[] = []
  visit(parse(pattern, flags).pattern as RegexNode, (node) => found.push(node.kind))
  return found
}

describe('childrenOf', () => {
  it('lists the alternatives of a pattern', () => {
    expect(childrenOf(parse('a|b', '').pattern as RegexNode).map((node) => node.kind)).toEqual(['Alternative', 'Alternative'])
  })
  it('lists the operands of an operation', () => {
    const cls = parse('[a--b]', 'v').pattern?.alternatives[0]?.elements[0] as RegexNode & { expression: RegexNode }
    expect(childrenOf(cls.expression).map((node) => node.kind)).toEqual(['Character', 'Character'])
  })
  it('lists nothing under a character', () => {
    expect(childrenOf(parse('a', '').pattern?.alternatives[0]?.elements[0] as RegexNode)).toEqual([])
  })
})

describe('visit', () => {
  it('walks parents before children in source order', () => {
    expect(kinds('(?<n>a)+\\k<n>|[b-c\\d]', '')).toEqual([
      'Pattern',
      'Alternative',
      'Quantifier',
      'CapturingGroup',
      'Alternative',
      'Character',
      'Backreference',
      'Alternative',
      'CharacterClass',
      'CharacterClassRange',
      'Character',
      'Character',
      'CharacterSet',
    ])
  })
  it('walks into expression classes, string disjunctions and lookarounds', () => {
    expect(kinds('(?<=x)[[\\q{ab|}]&&\\p{L}]', 'v')).toEqual([
      'Pattern',
      'Alternative',
      'Lookaround',
      'Alternative',
      'Character',
      'ExpressionCharacterClass',
      'ClassOperation',
      'CharacterClass',
      'ClassStringDisjunction',
      'StringAlternative',
      'Character',
      'Character',
      'StringAlternative',
      'CharacterSet',
    ])
  })
})
