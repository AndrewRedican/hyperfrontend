import { describe, expect, it } from '@hyperfrontend/testing'
import { isSafePattern } from './star-height'

/**
 * The verdicts for a list of patterns.
 *
 * @param patterns - The patterns judged
 * @returns Each pattern with its verdict
 */
function verdicts(patterns: readonly string[]): string[] {
  return patterns.map((pattern) => `${pattern} ${isSafePattern(pattern) ? 'safe' : 'unsafe'}`)
}

describe('isSafePattern', () => {
  it('accepts single repetitions, escapes, classes and named groups', () => {
    expect(verdicts(['a+', 'a+?', '\\d+', '[]a]+', '[^\\]]*', '(?<name>a)+', '(?=a)', '(?!a)', '(?:a)'])).toEqual([
      'a+ safe',
      'a+? safe',
      '\\d+ safe',
      '[]a]+ safe',
      '[^\\]]* safe',
      '(?<name>a)+ safe',
      '(?=a) safe',
      '(?!a) safe',
      '(?:a) safe',
    ])
  })

  it('rejects a repetition inside a repeated group', () => {
    expect(verdicts(['(a+)+', '(a?)*', '(a{2})+', '((a)+)+'])).toEqual(['(a+)+ unsafe', '(a?)* unsafe', '(a{2})+ unsafe', '((a)+)+ unsafe'])
  })

  it('does not look into a repeated group of alternatives', () => {
    expect(verdicts(['(?:a|b+)+', '(a|)+'])).toEqual(['(?:a|b+)+ safe', '(a|)+ safe'])
  })

  it('reads braces that do not quantify as characters', () => {
    expect(verdicts(['x{,3}', 'x{1', 'x{a}', 'a{2,}'])).toEqual(['x{,3} safe', 'x{1 safe', 'x{a} safe', 'a{2,} safe'])
  })

  it('rejects a pattern past the repetition limit', () => {
    expect([isSafePattern('a?'.repeat(25)), isSafePattern('a?'.repeat(26))]).toEqual([true, false])
  })

  it('rejects what the scanner cannot read', () => {
    expect(verdicts(['[', '(', ')', '\\', '*a', '(?<=a)b', '(?i:a)', '(?<1a>)', '(?<a'])).toEqual([
      '[ unsafe',
      '( unsafe',
      ') unsafe',
      '\\ unsafe',
      '*a unsafe',
      '(?<=a)b unsafe',
      '(?i:a) unsafe',
      '(?<1a>) unsafe',
      '(?<a unsafe',
    ])
  })
})
