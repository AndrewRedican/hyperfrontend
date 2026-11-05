import { describe, expect, it } from '@hyperfrontend/testing'
import { polynomialRepetition } from './polynomial'

/**
 * The verdicts for a list of patterns, each with its flags.
 *
 * @param patterns - The patterns judged, as `[pattern, flags]`
 * @returns Each pattern with the repetition reported, or `linear`
 */
function verdicts(patterns: readonly (readonly [string, string])[]): string[] {
  return patterns.map(([pattern, flags]) => {
    const span = polynomialRepetition(pattern, flags)
    return `/${pattern}/${flags} ${span === null ? 'linear' : pattern.slice(span.start, span.end)}`
  })
}

describe('polynomialRepetition', () => {
  it('reports a repetition with no start anchor and something after it that can fail', () => {
    expect(
      verdicts([
        ['(\\\\+)$', ''],
        ['\\s+$', ''],
        ['0+$', ''],
        ['a+b', ''],
        ['[^/]+\\.ts$', ''],
        ['^\\s+|\\s+$', 'g'],
      ])
    ).toEqual(['/(\\\\+)$/ \\\\+', '/\\s+$/ \\s+', '/0+$/ 0+', '/a+b/ a+', '/[^/]+\\.ts$/ [^/]+', '/^\\s+|\\s+$/g \\s+'])
  })

  it('reports a repetition whose required prefix can match what it repeats', () => {
    expect(
      verdicts([
        ['\\n\\s*$', ''],
        ['(?:\\s|,)\\s+x', ''],
        ['a?b*c', ''],
        ['X+y', 'i'],
        ['[A-Z]x*$', 'i'],
        ['\\x78+$', ''],
      ])
    ).toEqual(['/\\n\\s*$/ \\s*', '/(?:\\s|,)\\s+x/ \\s+', '/a?b*c/ b*', '/X+y/i X+', '/[A-Z]x*$/i x*', '/\\x78+$/ \\x78+'])
  })

  it('reports a repetition of a group whose alternatives share a character', () => {
    expect(
      verdicts([
        ['(?:a|b)+c', ''],
        ['(?:\\s|\\n)+$', ''],
        ['(?:a|b(?=c))+d', ''],
      ])
    ).toEqual(['/(?:a|b)+c/ (?:a|b)+', '/(?:\\s|\\n)+$/ (?:\\s|\\n)+', '/(?:a|b(?=c))+d/ (?:a|b(?=c))+'])
  })

  it('reports dots and negated sets, which skip line terminators or the excluded characters', () => {
    expect(
      verdicts([
        ['.+$', ''],
        ['\\D+x', ''],
        ['[^\\n]+$', ''],
        ['\\p{L}+1', 'u'],
      ])
    ).toEqual(['/.+$/ .+', '/\\D+x/ \\D+', '/[^\\n]+$/ [^\\n]+', '/\\p{L}+1/u \\p{L}+'])
  })

  it('accepts a pattern anchored at its start, sticky, or with a word boundary or lookaround before the repetition', () => {
    expect(
      verdicts([
        ['^\\s+$', ''],
        ['\\s+$', 'y'],
        ['\\b\\w+$', ''],
        ['(?<=a)b+c', ''],
        ['(a)\\1+b', ''],
      ])
    ).toEqual(['/^\\s+$/ linear', '/\\s+$/y linear', '/\\b\\w+$/ linear', '/(?<=a)b+c/ linear', '/(a)\\1+b/ linear'])
  })

  it('accepts a repetition whose prefix needs a character it does not repeat', () => {
    expect(
      verdicts([
        [',\\s*$', ''],
        ['x\\s*$', ''],
        ['failing tests:\\s*$', ''],
        ['\\$\\d+$', ''],
        ['(?:ab)+c', ''],
      ])
    ).toEqual(['/,\\s*$/ linear', '/x\\s*$/ linear', '/failing tests:\\s*$/ linear', '/\\$\\d+$/ linear', '/(?:ab)+c/ linear'])
  })

  it('accepts a repetition after which the match always succeeds', () => {
    expect(
      verdicts([
        ['\\s+', 'g'],
        ['a+b?', ''],
        ['[\\s\\S]+$', ''],
        ['.+$', 's'],
        ['.+$', 'm'],
        ['a+(?:b|)', ''],
      ])
    ).toEqual(['/\\s+/g linear', '/a+b?/ linear', '/[\\s\\S]+$/ linear', '/.+$/s linear', '/.+$/m linear', '/a+(?:b|)/ linear'])
  })

  it('accepts a negative lookahead after the repetition that backing off or the end of the stretch always satisfies', () => {
    expect(
      verdicts([
        ['[A-Z]+(?![a-z])', 'g'],
        ['[A-Z]+(?![A-Z])', ''],
        ['[A-Z]+(?![a-z]|\\d)', ''],
        ['[A-Z]+(?![a-z]+:)', ''],
        ['[A-Z]+(?![A-Z0])', ''],
        ['[A-Z]+(?=[a-z])', ''],
        ['[A-Z]+(?!x?)', ''],
        ['[A-Z]+(?!\\b)', ''],
        ['[A-Z]+(?<!a)', ''],
      ])
    ).toEqual([
      '/[A-Z]+(?![a-z])/g linear',
      '/[A-Z]+(?![A-Z])/ linear',
      '/[A-Z]+(?![a-z]|\\d)/ linear',
      '/[A-Z]+(?![a-z]+:)/ linear',
      '/[A-Z]+(?![A-Z0])/ [A-Z]+',
      '/[A-Z]+(?=[a-z])/ [A-Z]+',
      '/[A-Z]+(?!x?)/ [A-Z]+',
      '/[A-Z]+(?!\\b)/ [A-Z]+',
      '/[A-Z]+(?<!a)/ [A-Z]+',
    ])
  })

  it('accepts bounded repetitions, repetitions nested in another or in a lookaround, and patterns that do not parse', () => {
    expect(
      verdicts([
        ['a{1,5}$', ''],
        ['(?:a+b)*', ''],
        ['x(?=a+b)', ''],
        ['(', ''],
      ])
    ).toEqual(['/a{1,5}$/ linear', '/(?:a+b)*/ linear', '/x(?=a+b)/ linear', '/(/ linear'])
  })

  it('reads ranges, and takes a v-flag set expression or string class as matching every character', () => {
    expect(
      verdicts([
        ['[a-c]+d', ''],
        ['[\\w--\\d]+x', 'v'],
        ['[\\q{ab}]+x', 'v'],
        ['[\\q{ab}]+$', 'v'],
      ])
    ).toEqual(['/[a-c]+d/ [a-c]+', '/[\\w--\\d]+x/v [\\w--\\d]+', '/[\\q{ab}]+x/v [\\q{ab}]+', '/[\\q{ab}]+$/v linear'])
  })
})
