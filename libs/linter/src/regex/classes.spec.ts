import type { RegexNode } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { mayContainStrings, readCharacterClass } from './classes'
import { parse } from './parse'
import { PatternReader } from './reader'

/**
 * The first class of a `v` pattern.
 *
 * @param pattern - The pattern, starting with a class
 * @returns The first class node of the parsed pattern
 */
function firstClass(pattern: string): RegexNode {
  return parse(pattern, 'v').pattern?.alternatives[0]?.elements[0] as RegexNode
}

describe('mayContainStrings', () => {
  it('tells a string disjunction with a string of other than one character', () => {
    expect([
      mayContainStrings(firstClass('[\\q{ab}]')),
      mayContainStrings(firstClass('[\\q{a|b}]')),
      mayContainStrings(firstClass('[\\q{}]')),
    ]).toEqual([true, false, true])
  })
  it('tells a property of strings', () => {
    expect([mayContainStrings(firstClass('[\\p{RGI_Emoji}]')), mayContainStrings(firstClass('[\\p{L}]'))]).toEqual([true, false])
  })
  it('tells an intersection by both operands and a subtraction by its first', () => {
    expect([
      mayContainStrings(firstClass('[\\q{ab}&&\\q{cd}]')),
      mayContainStrings(firstClass('[\\q{ab}&&a]')),
      mayContainStrings(firstClass('[\\q{ab}--a]')),
      mayContainStrings(firstClass('[a--\\q{ab}]')),
    ]).toEqual([true, false, true, false])
  })
  it('tells a negated class to hold none', () => {
    expect([mayContainStrings(firstClass('[^a]')), mayContainStrings(firstClass('[a-z]'))]).toEqual([false, false])
  })
})

describe('readCharacterClass', () => {
  it('reads a flat class under no flag, with the parents of its elements set', () => {
    const reader = new PatternReader('[a-c\\d]x', false, false)
    reader.index = 1
    const node = readCharacterClass(reader, 0)
    const elements = (node as RegexNode & { elements: RegexNode[] }).elements
    expect([node.kind, node.start, node.end, reader.index, elements.map((element) => [element.kind, element.parent === node])]).toEqual([
      'CharacterClass',
      0,
      7,
      7,
      [
        ['CharacterClassRange', true],
        ['CharacterSet', true],
      ],
    ])
  })
  it('reads a chained operation under the v flag, nested to the left', () => {
    const reader = new PatternReader('[a--b--c]', true, true)
    reader.index = 1
    const node = readCharacterClass(reader, 0) as RegexNode & { expression: RegexNode & { left: RegexNode; right: RegexNode } }
    const { expression } = node
    expect([
      node.kind,
      expression.parent === node,
      expression.left.kind,
      expression.left.parent === expression,
      expression.right.parent === expression,
      expression.start,
      expression.end,
    ]).toEqual(['ExpressionCharacterClass', true, 'ClassOperation', true, true, 0, 8])
  })
  it('spans the strings of a disjunction without their separators', () => {
    const disjunction = (firstClass('[\\q{ab|c|}]') as RegexNode & { elements: RegexNode[] }).elements[0] as RegexNode & {
      alternatives: RegexNode[]
    }
    expect(disjunction.alternatives.map((alternative) => [alternative.start, alternative.end, alternative.parent === disjunction])).toEqual(
      [
        [4, 6, true],
        [7, 8, true],
        [9, 9, true],
      ]
    )
  })
})
