import type { ParseError, PatternNode, RegexNode } from './model'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parse } from './parse'

/**
 * Renders a tree compactly: characters quoted when printable, otherwise as `U+` and hex; sets as
 * their escapes; groups with their kind and number; quantifiers as `{min,max}` with a `?` when lazy.
 *
 * @param node - The node rendered
 * @returns The rendering
 */
function render(node: RegexNode): string {
  switch (node.kind) {
    case 'Pattern':
    case 'ClassStringDisjunction':
      return node.alternatives.map(render).join('|')
    case 'Alternative':
    case 'StringAlternative':
      return node.elements.map(render).join('')
    case 'Group':
      return `(?${node.modifiers ?? ''}:${node.alternatives.map(render).join('|')})`
    case 'CapturingGroup':
      return `(${node.name === null ? '' : `?<${node.name}>`}${node.alternatives.map(render).join('|')})#${node.index}`
    case 'Lookaround':
      return `(?${node.behind ? '<' : ''}${node.negate ? '!' : '='}${node.alternatives.map(render).join('|')})`
    case 'Quantifier':
      return `${render(node.element)}{${node.min},${node.max}}${node.greedy ? '' : '?'}`
    case 'Assertion':
      return `<${node.assertion}>`
    case 'Character':
      return node.value >= 0x20 && node.value < 0x7f ? `'${fromCodePoint(node.value)}'` : `U+${node.value.toString(16).toUpperCase()}`
    case 'CharacterSet':
      return renderSet(node.set, node.negate, node.key, node.value)
    case 'CharacterClass':
      return `[${node.negate ? '^' : ''} ${node.elements.map(render).join(' ')} ]`
    case 'ExpressionCharacterClass':
      return `[${node.negate ? '^' : ''} ${render(node.expression)} ]`
    case 'ClassOperation':
      return `(${render(node.left)} ${node.operator === 'intersection' ? '&&' : '--'} ${render(node.right)})`
    case 'CharacterClassRange':
      return `${render(node.from)}-${render(node.to)}`
    default:
      return `${node.raw}->${node.resolved.map((group) => group.index).join(',')}`
  }
}

/**
 * Renders a character set as the escape that wrote it.
 *
 * @param set - Which set
 * @param negate - Whether it is the complement
 * @param key - A property's name
 * @param value - A property's value
 * @returns The rendering
 */
function renderSet(set: string, negate: boolean, key: string | null, value: string | null): string {
  if (set === 'any') return '.'
  if (set === 'property') return `\\${negate ? 'P' : 'p'}{${key}${value === null ? '' : `=${value}`}}`
  const letter = (set as string)[0] as string
  return `\\${negate ? letter.toUpperCase() : letter}`
}

/**
 * Parses and renders a pattern, or names its error.
 *
 * @param pattern - The pattern parsed
 * @param flags - Its flags
 * @returns The rendering, or the error
 */
function outcome(pattern: string, flags = ''): string | ParseError {
  const result = parse(pattern, flags)
  return result.error ?? render(result.pattern as RegexNode)
}

/** Patterns that parse, with their rendering. */
const TREES: ReadonlyArray<readonly [string, string, string]> = [
  ['abc', '', "'a''b''c'"],
  ['a|b|', '', "'a'|'b'|"],
  ['', '', ''],
  ['(a)(?:b)(?<n>c)', '', "('a')#1(?:'b')(?<n>'c')#2"],
  ['(?=a)(?!b)(?<=c)(?<!d)', '', "(?='a')(?!'b')(?<='c')(?<!'d')"],
  ['a*b+?c?d{2}e{3,}f{4,5}?', '', "'a'{0,Infinity}'b'{1,Infinity}?'c'{0,1}'d'{2,2}'e'{3,Infinity}'f'{4,5}?"],
  ['^$\\b\\B', '', '<start><end><word-boundary><non-word-boundary>'],
  ['.\\d\\D\\s\\S\\w\\W', '', '.\\d\\D\\s\\S\\w\\W'],
  ['\\p{L}\\P{Script=Latin}', 'u', '\\p{L}\\P{Script=Latin}'],
  ['\\p{RGI_Emoji}', 'v', '\\p{RGI_Emoji}'],
  ['\\p{L}', '', "'p''{''L''}'"],
  ['(a)\\1\\k<n>(?<n>b)', '', "('a')#1\\1->1\\k<n>->2(?<n>'b')#2"],
  ['(?<n>a)|(?<n>b)\\k<n>', '', "(?<n>'a')#1|(?<n>'b')#2\\k<n>->2"],
  ['\\k<n>(?:(?<n>a)|(?<n>b))', '', "\\k<n>->1,2(?:(?<n>'a')#1|(?<n>'b')#2)"],
  ['(?<n>a)|\\k<n>|(?<n>b)', '', "(?<n>'a')#1|\\k<n>->1,2|(?<n>'b')#2"],
  ['\\k<n>', '', "'k''<''n''>'"],
  ['\\2(a)', '', "U+2('a')#1"],
  ['[abc]', '', "[ 'a' 'b' 'c' ]"],
  ['[^a-z\\d]', '', "[^ 'a'-'z' \\d ]"],
  ['[a-\\d]', '', "[ 'a' '-' \\d ]"],
  ['[\\d-a]', '', "[ \\d '-' 'a' ]"],
  ['[a-]', '', "[ 'a' '-' ]"],
  ['[-a]', '', "[ '-' 'a' ]"],
  ['[a-\\p]', '', "[ 'a'-'p' ]"],
  ['[\\b\\-\\cA\\c0\\c_]', '', "[ U+8 '-' U+1 U+10 U+1F ]"],
  ['[\\c]', '', "[ '\\' 'c' ]"],
  ['[\\k]', '', "[ 'k' ]"],
  ['[\\1\\8]', '', "[ U+1 '8' ]"],
  ['\\t\\n\\v\\f\\r\\0\\x41\\u0042\\u{43}', 'u', "U+9U+AU+BU+CU+DU+0'A''B''C'"],
  ['\\u{43}\\x4\\u12', '', "'u'{43,43}'x''4''u''1''2'"],
  ['\\1\\12\\123\\400\\08\\8\\c\\k', '', "U+1U+A'S'' ''0'U+0'8''8''\\''c''k'"],
  ['\\uD83D\\uDC4D', 'u', 'U+1F44D'],
  ['\\uD83D\\uDC4D', '', 'U+D83DU+DC4D'],
  ['\\uD83D\\u0041', 'u', "U+D83D'A'"],
  ['👍', 'u', 'U+1F44D'],
  ['👍', '', 'U+D83DU+DC4D'],
  ['\\u{1F44D}', 'u', 'U+1F44D'],
  ['(?i:a)(?-m:b)(?ims-:c)', '', "(?i:'a')(?-m:'b')(?ims-:'c')"],
  ['(?=a)*', '', "(?='a'){0,Infinity}"],
  ['a{,2}a{1,2b{', '', "'a''{'',''2''}''a''{''1'',''2''b''{'"],
  ['a{1}', 'u', "'a'{1,1}"],
  ['{}]', '', "'{''}'']'"],
  ['(?<𝒜>.)(?<\\u{41}\\u0042>.)(?<\\uD835\\uDC9E>.)', '', '(?<𝒜>.)#1(?<AB>.)#2(?<𝒞>.)#3'],
  ['[a--b]', 'v', "[ ('a' -- 'b') ]"],
  ['[a&&b&&c]', 'v', "[ (('a' && 'b') && 'c') ]"],
  ['[[a][b]]', 'v', "[ [ 'a' ] [ 'b' ] ]"],
  ['[[a]--[b]]', 'v', "[ ([ 'a' ] -- [ 'b' ]) ]"],
  ['[\\d--\\p{L}]', 'v', '[ (\\d -- \\p{L}) ]'],
  ['[\\q{ab|c|}]', 'v', "[ 'a''b'|'c'| ]"],
  ['[\\q{\\n\\b\\-\\@\\$}]', 'v', "[ U+AU+8'-''@''$' ]"],
  ['[a-z]', 'v', "[ 'a'-'z' ]"],
  ['[]', 'v', '[  ]'],
  ['[^a]', 'v', "[^ 'a' ]"],
  ['[\\&&]', 'v', "[ '&' '&' ]"],
  ['[\\b\\-]', 'v', "[ U+8 '-' ]"],
  ['[^\\q{a}--\\q{b}]', 'v', "[^ ('a' -- 'b') ]"],
  ['[^\\q{ab}&&\\q{a}]', 'v', "[^ ('a''b' && 'a') ]"],
  ['[^[^a]b]', 'v', "[^ [^ 'a' ] 'b' ]"],
]

/** Patterns that are refused, with the error. */
const ERRORS: ReadonlyArray<readonly [string, string, string, number]> = [
  ['(', '', 'Unterminated group', 1],
  [')', '', "Unmatched ')'", 0],
  ['[', '', 'Unterminated character class', 1],
  ['\\', '', '\\ at end of pattern', 1],
  ['*', '', 'Nothing to repeat', 0],
  ['a**', '', 'Nothing to repeat', 2],
  ['{1}', '', 'Nothing to repeat', 0],
  ['a{1}{2}', '', 'Nothing to repeat', 4],
  ['a{2,1}', '', 'numbers out of order in {} quantifier', 6],
  ['a{', 'u', 'Incomplete quantifier', 2],
  ['{', 'u', 'Lone quantifier brackets', 0],
  ['}', 'u', 'Lone quantifier brackets', 0],
  [']', 'u', 'Lone quantifier brackets', 0],
  ['(?=a)*', 'u', 'Nothing to repeat', 5],
  ['(?<=a)*', '', 'Nothing to repeat', 6],
  ['\\a', 'u', 'Invalid escape', 1],
  ['\\c', 'u', 'Invalid escape', 1],
  ['\\x4', 'u', 'Invalid escape', 1],
  ['\\u12', 'u', 'Invalid unicode escape', 2],
  ['\\u{}', 'u', 'Invalid unicode escape', 3],
  ['\\u{110000}', 'u', 'Invalid unicode escape', 9],
  ['\\u{41', 'u', 'Invalid unicode escape', 5],
  ['\\uD83D\\u', 'u', 'Invalid unicode escape', 8],
  ['\\2(a)', 'u', 'Invalid escape', 2],
  ['\\k', 'u', 'Invalid named reference', 2],
  ['\\k<', 'u', 'Invalid capture group name', 3],
  ['\\k<a>', 'u', 'Invalid named capture referenced', 5],
  ['(?<a>x)\\k', '', 'Invalid named reference', 9],
  ['(?<a>x)(?<a>y)', '', 'Duplicate capture group name', 12],
  ['(?<1>x)', '', 'Invalid capture group name', 3],
  ['(?<a', '', 'Invalid capture group name', 3],
  ['(?<>x)', '', 'Invalid capture group name', 3],
  ['(?<\\x41>x)', '', 'Invalid capture group name', 4],
  ['(?<\\u41>x)', '', 'Invalid capture group name', 5],
  ['(?<\\u{110000}>x)', '', 'Invalid unicode escape', 12],
  ['(?<\\uD835>x)', '', 'Invalid capture group name', 3],
  ['(?<a\\uD835\\u0041>x)', '', 'Invalid capture group name', 3],
  ['(?g:x)', '', 'Invalid group', 2],
  ['(?-:x)', '', 'Invalid empty flags', 3],
  ['(?-u:x)', '', 'Invalid group', 3],
  ['(?ii:x)', '', "Duplicated flag 'i'", 3],
  ['(?i)', '', 'Invalid group', 3],
  ['(?i:a', '', 'Unterminated group', 5],
  ['\\p', 'u', 'Invalid property name', 2],
  ['\\p{}', 'u', 'Invalid property name', 3],
  ['\\p{L', 'u', 'Invalid property name', 4],
  ['\\p{L=}', 'u', 'Invalid property name', 5],
  ['\\p{RGI_Emoji}', 'u', 'Invalid property name', 13],
  ['\\P{RGI_Emoji}', 'v', 'Invalid property name', 13],
  ['[b-a]', '', 'Range out of order in character class', 4],
  ['[a-\\d]', 'u', 'Invalid character class', 2],
  ['[\\d-a]', 'u', 'Invalid character class', 3],
  ['[a-\\p{L}]', 'u', 'Invalid character class', 8],
  ['[\\c]', 'u', 'Invalid escape', 2],
  ['(?<a>x)[\\k]', '', 'Invalid escape', 9],
  ['[\\', '', '\\ at end of pattern', 2],
  ['[a-', '', 'Unterminated character class', 3],
  ['[a--b&&c]', 'v', 'Invalid character in character class', 5],
  ['[a--]', 'v', 'Invalid character in character class', 4],
  ['[a--', 'v', 'Unterminated character class', 4],
  ['[a&&b', 'v', 'Unterminated character class', 5],
  ['[a-b--c]', 'v', 'Invalid character in character class', 4],
  ['[a', 'v', 'Unterminated character class', 2],
  ['[&&]', 'v', 'Invalid character in character class', 1],
  ['[(]', 'v', 'Invalid character in character class', 1],
  ['[a-]', 'v', 'Invalid character in character class', 3],
  ['[a-\\d]', 'v', 'Invalid character class', 5],
  ['[b-a]', 'v', 'Range out of order in character class', 4],
  ['[^\\q{ab}]', 'v', 'Negated character class may contain strings', 9],
  ['[^[\\q{ab}]]', 'v', 'Negated character class may contain strings', 11],
  ['[^\\p{RGI_Emoji}]', 'v', 'Negated character class may contain strings', 16],
  ['[^\\q{ab}&&\\q{cd}]', 'v', 'Negated character class may contain strings', 17],
  ['[\\q{a-b}]', 'v', 'Invalid character in character class', 5],
  ['[\\q{!!}]', 'v', 'Invalid character in character class', 4],
  ['[\\q{a', 'v', 'Unterminated class string disjunction', 5],
  ['[\\q{\\', 'v', '\\ at end of pattern', 5],
  ['[\\q{\\k}]', 'v', 'Invalid escape', 5],
  ['[\\q]', 'v', 'Invalid escape', 3],
  ['[\\', 'v', '\\ at end of pattern', 2],
  ['[!!]', 'v', 'Invalid character in character class', 1],
  ['a', 'uv', 'Invalid regular expression flags', 0],
]

describe('parse', () => {
  for (const [pattern, flags, tree] of TREES) {
    it(`parses /${pattern}/${flags}`, () => {
      expect(outcome(pattern, flags)).toBe(tree)
    })
  }
  for (const [pattern, flags, message, index] of ERRORS) {
    it(`refuses /${pattern}/${flags} with ${message}`, () => {
      expect(outcome(pattern, flags)).toEqual({ message, index })
    })
  }
  it('keeps the characters read before a fault', () => {
    expect(parse('\\x1f[', '').characters.map((node) => [node.raw, node.value, node.start, node.end])).toEqual([['\\x1f', 0x1f, 0, 4]])
  })
  it('lists every character in order, those of classes and strings included', () => {
    expect(parse('a[b-c\\q{de}]', 'v').characters.map((node) => node.raw)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('resolves a numbered backreference to its group', () => {
    const { pattern } = parse('(a)\\1', '')
    const [group, reference] = (pattern as PatternNode).alternatives[0]?.elements ?? []
    expect((reference as RegexNode & { resolved: RegexNode[] }).resolved[0]).toBe(group)
  })
  it('places a quantified atom under its quantifier', () => {
    const { pattern } = parse('a+', '')
    const quantifier = parse('a+', '').pattern?.alternatives[0]?.elements[0]
    expect([quantifier?.kind, (quantifier as RegexNode & { element: RegexNode }).element.parent === quantifier, pattern?.end]).toEqual([
      'Quantifier',
      true,
      2,
    ])
  })
  it('spans a group from its opening to its closing parenthesis', () => {
    const group = parse('x(?<n>ab|c)y', '').pattern?.alternatives[0]?.elements[1]
    expect([
      group?.start,
      group?.end,
      (group as RegexNode & { alternatives: RegexNode[] }).alternatives.map((node) => [node.start, node.end]),
    ]).toEqual([
      1,
      11,
      [
        [6, 8],
        [9, 10],
      ],
    ])
  })
  it('links the parts of a range to the range and the range to its class', () => {
    const cls = parse('[a-z]', '').pattern?.alternatives[0]?.elements[0] as RegexNode & { elements: RegexNode[] }
    const range = cls.elements[0] as RegexNode & { from: RegexNode; to: RegexNode }
    expect([range.parent === cls, range.from.parent === range, range.to.parent === range, range.start, range.end]).toEqual([
      true,
      true,
      true,
      1,
      4,
    ])
  })
})
