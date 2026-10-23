/**
 * Literal values: the decoded text of a string or template, and the literal nodes for strings,
 * numbers, bigints, regular expressions and keywords.
 *
 * @module code/literals
 */

import type { Node } from './model'
import type { Parser } from './parser'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'

/** The single-character escapes. */
const SIMPLE_ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }

/**
 * Decodes the escapes of a string or template body.
 *
 * @param raw - The text between the delimiters
 * @param template - Whether the text is a template, where `\r\n` is one line feed
 * @param sloppy - Whether legacy octal escapes and `\8` and `\9` are allowed, as in a non-strict script's strings
 * @returns The decoded text, or null when an escape is invalid
 *
 * @example Decode a string body, strict and sloppy
 * ```ts
 * cook('line\\none', false) // => 'line\none'
 * cook('\\x4', false) // => null (a hex escape needs two digits)
 * cook('code \\101', false) // => null (octal is strict-mode invalid)
 * cook('code \\101', false, true) // => 'code A'
 * ```
 */
export function cook(raw: string, template: boolean, sloppy = false): string | null {
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (template && char === '\r') {
      out += '\n'
      if (raw[index + 1] === '\n') index += 1
      continue
    }
    if (char !== '\\') {
      out += char
      continue
    }
    index += 1
    const escaped = raw[index]
    if (escaped === undefined) return null
    if (escaped === '\r' || escaped === '\n' || escaped === ' ' || escaped === ' ') {
      if (escaped === '\r' && raw[index + 1] === '\n') index += 1
      continue
    }
    if (escaped === 'x') {
      const hex = raw.slice(index + 1, index + 3)
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null
      out += fromCodePoint(parseInt(hex, 16))
      index += 2
    } else if (escaped === 'u') {
      const braced = raw[index + 1] === '{'
      const close = braced ? raw.indexOf('}', index + 2) : index + 5
      const hex = braced ? raw.slice(index + 2, close) : raw.slice(index + 1, index + 5)
      if (close === -1 || !/^[0-9a-fA-F]+$/.test(hex) || (!braced && hex.length !== 4)) return null
      const code = parseInt(hex, 16)
      if (code > 0x10ffff) return null
      out += fromCodePoint(code)
      index = braced ? close : index + 4
    } else if (escaped === '0' && !/[0-9]/.test(raw[index + 1] ?? '')) out += '\0'
    else if (/[0-9]/.test(escaped)) {
      if (!sloppy || template) return null
      if (escaped === '8' || escaped === '9') out += escaped
      else {
        // how: a legacy octal escape takes up to three digits, the first below 4 when there are three.
        const limit = escaped < '4' ? 3 : 2
        let length = 1
        while (length < limit && /[0-7]/.test(raw[index + length] ?? '')) length += 1
        out += fromCodePoint(parseInt(raw.slice(index, index + length), 8))
        index += length - 1
      }
    } else out += SIMPLE_ESCAPES[escaped] ?? escaped
  }
  return out
}

/**
 * What is wrong with the first invalid escape of a string, as the compiler words it.
 *
 * @param raw - The text between the quotes
 * @returns The message
 */
function escapeError(raw: string): string {
  const escape = /\\(?:([1-7]|0(?=[0-9]))|([89])|(x)|(u))/.exec(raw)
  if (escape === null || escape[1] !== undefined) return 'Octal escape sequences are not allowed in strict mode.'
  if (escape[2] !== undefined) return `Escape sequence '\\${escape[2]}' is not allowed.`
  return escape[3] !== undefined || !raw.includes('\\u{') ? 'Hexadecimal digit expected.' : 'Unterminated Unicode escape sequence.'
}

/**
 * Parses the current token as a string literal.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a string with a unicode escape
 * ```ts
 * const p = new Parser("'caf\\u00e9'", '.ts')
 * parseStringLiteral(p)
 * // => { kind: 'Literal', value: 'café', raw: "'caf\\u00e9'", ... }
 * ```
 */
export function parseStringLiteral(p: Parser): Node {
  const token = p.next()
  const raw = p.text.slice(token.start, token.end)
  const value = cook(raw.slice(1, -1), false, p.sloppy)
  if (value === null) p.fail(escapeError(raw.slice(1, -1)), token.start)
  return p.node('Literal', token.start, { value, raw })
}

/**
 * Parses the current token as a number or bigint literal.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a bigint with separators
 * ```ts
 * const literal = parseNumberLiteral(new Parser('1_000n', '.ts'))
 * literal.value // => 1000n
 * literal.bigint // => '1000'
 * literal.raw // => '1_000n'
 * ```
 */
export function parseNumberLiteral(p: Parser): Node {
  const token = p.next()
  const raw = p.text.slice(token.start, token.end)
  const digits = raw.replace(/_/g, '')
  if (digits.endsWith('n')) return p.node('Literal', token.start, { value: BigInt(digits.slice(0, -1)), bigint: digits.slice(0, -1), raw })
  const value = /^0[oObB]/.test(digits) ? parseInt(digits.slice(2), digits[1] === 'o' || digits[1] === 'O' ? 8 : 2) : Number(digits)
  return p.node('Literal', token.start, { value, raw })
}

/**
 * Parses the current token as a regular expression literal.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a regular expression after rescanning its slash
 * ```ts
 * const p = new Parser('/^v\\d+/gi', '.ts')
 * p.scanner.rescanSlash()
 * parseRegexLiteral(p).regex // => { pattern: '^v\\d+', flags: 'gi' }
 * ```
 */
export function parseRegexLiteral(p: Parser): Node {
  const token = p.next()
  const raw = p.text.slice(token.start, token.end)
  const slash = raw.lastIndexOf('/')
  const regex = { pattern: raw.slice(1, slash), flags: raw.slice(slash + 1) }
  // why: the rules read a regular expression's pattern and flags; nothing in a parse needs the expression compiled.
  return p.node('Literal', token.start, { value: null, raw, regex })
}

/**
 * Parses the current word as `true`, `false` or `null`.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse null and false
 * ```ts
 * parseKeywordLiteral(new Parser('null', '.ts')).value // => null
 * parseKeywordLiteral(new Parser('false', '.ts')).value // => false
 * ```
 */
export function parseKeywordLiteral(p: Parser): Node {
  const token = p.next()
  return p.node('Literal', token.start, { value: token.value === 'null' ? null : token.value === 'true', raw: token.value })
}

/**
 * Parses a template literal from its head or full token, parsing each substitution with the
 * given expression parser.
 *
 * @param p - The parser
 * @param parseExpression - How a substitution is parsed
 * @param kind - The node kind, a template literal or a template literal type
 * @returns The node built
 *
 * @example Parse a template with one substitution
 * ```ts
 * const p = new Parser('`Hello ${name}!`', '.ts')
 * const node = parseTemplate(p, () => parseExpression(p), 'TemplateLiteral')
 * node.quasis.map((quasi) => quasi.value.cooked) // => ['Hello ', '!']
 * node.expressions[0].name // => 'name'
 * ```
 */
export function parseTemplate(p: Parser, parseExpression: () => Node, kind: 'TemplateLiteral' | 'TSTemplateLiteralType'): Node {
  const start = p.token.start
  const quasis: Node[] = []
  const expressions: Node[] = []
  for (;;) {
    const token = p.token
    const tail = token.part === 'full' || token.part === 'tail'
    const raw = p.text.slice(token.start + 1, token.end - (tail ? 1 : 2))
    p.next()
    quasis.push(p.node('TemplateElement', token.start, { value: { raw, cooked: cook(raw, true) }, tail }))
    if (tail) break
    expressions.push(parseExpression())
    if (!p.is('}')) p.fail("'}' expected.")
    p.scanner.rescanTemplate()
  }
  return p.node(kind, start, kind === 'TemplateLiteral' ? { quasis, expressions } : { quasis, types: expressions })
}
