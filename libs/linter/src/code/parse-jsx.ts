/**
 * JSX: elements and fragments with their attributes and children, scanned in the modes JSX
 * needs: hyphenated names inside tags, raw text between tags.
 *
 * @module code/parse-jsx
 */

import type { Node } from './model'
import type { Parser, ScanMode } from './parser'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { parseAssignment, parseExpression } from './parse-expressions'
import { parseTypeArguments } from './parse-types'

/** The named entities JSX text decodes. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  hellip: '…',
  mdash: '—',
  ndash: '–',
}

/**
 * Parses a JSX element or fragment, from its `<`.
 *
 * @param p - The parser
 * @param inChildren - Whether the element sits among JSX children, so the token after it is scanned as a child
 * @returns The node built
 *
 * @example Parse an element with an entity in its text
 * ```ts
 * const p = new Parser('<Button kind="primary">Save &amp; close</Button>', '.tsx')
 * const [text] = parseJsxElement(p).children
 * text.value // => 'Save & close'
 * text.raw // => 'Save &amp; close'
 * ```
 */
export function parseJsxElement(p: Parser, inChildren = false): Node {
  const start = p.token.start
  const after: ScanMode = inChildren ? 'jsxChild' : 'normal'
  p.next('jsxName')
  if (p.is('>')) {
    p.next('jsxChild')
    const openingFragment = p.node('JSXOpeningFragment', start)
    const children = parseChildren(p, null)
    const closingStart = p.token.start
    p.next()
    p.expect('/', 'jsxName')
    p.expect('>', after)
    const closingFragment = p.node('JSXClosingFragment', closingStart)
    return p.node('JSXFragment', start, { openingFragment, children, closingFragment })
  }
  const name = parseTagName(p)
  const typeArguments = p.is('<') ? parseTypeArguments(p) : undefined
  const attributes: Node[] = []
  while (!p.is('>') && !p.is('/')) attributes.push(parseAttribute(p))
  if (p.eat('/')) {
    p.expect('>', after)
    const openingElement = p.node('JSXOpeningElement', start, { name, typeArguments, attributes, selfClosing: true })
    return p.node('JSXElement', start, { openingElement, children: [], closingElement: null })
  }
  p.expect('>', 'jsxChild')
  const openingElement = p.node('JSXOpeningElement', start, { name, typeArguments, attributes, selfClosing: false })
  const children = parseChildren(p, tagText(p, name))
  const closingStart = p.token.start
  p.next()
  p.expect('/', 'jsxName')
  const closingName = parseTagName(p)
  if (tagText(p, closingName) !== tagText(p, name))
    p.fail(`Expected corresponding JSX closing tag for '${tagText(p, name)}'.`, closingStart)
  p.expect('>', after)
  const closingElement = p.node('JSXClosingElement', closingStart, { name: closingName })
  return p.node('JSXElement', start, { openingElement, children, closingElement })
}

/**
 * The text of a tag name, for matching a closing tag to its opening one.
 *
 * @param p - The parser
 * @param name - The name node
 * @returns Its source text
 */
function tagText(p: Parser, name: Node): string {
  return p.text.slice(name.start, name.end).replace(/\s/g, '')
}

/**
 * Parses a tag name: an identifier, a namespaced name or a member chain.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseTagName(p: Parser): Node {
  const start = p.token.start
  if (p.token.kind !== 'name') p.fail('Identifier expected.')
  let name = jsxIdentifier(p)
  if (p.is(':')) {
    p.next('jsxName')
    const local = jsxIdentifier(p)
    return p.node('JSXNamespacedName', start, { namespace: name, name: local })
  }
  while (p.is('.')) {
    p.next('jsxName')
    const property = jsxIdentifier(p)
    name = p.node('JSXMemberExpression', start, { object: name, property })
  }
  return name
}

/**
 * Parses the current name token as a JSX identifier, the next token scanned as a JSX name.
 *
 * @param p - The parser
 * @returns The node built
 */
function jsxIdentifier(p: Parser): Node {
  if (p.token.kind !== 'name') p.fail('Identifier expected.')
  const token = p.next('jsxName')
  return p.node('JSXIdentifier', token.start, { name: token.value })
}

/**
 * Parses one attribute: a spread, or a name with an optional value.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseAttribute(p: Parser): Node {
  const start = p.token.start
  if (p.is('{')) {
    p.next()
    p.expect('...')
    const argument = parseAssignment(p)
    p.expect('}', 'jsxName')
    return p.node('JSXSpreadAttribute', start, { argument })
  }
  if (p.token.kind !== 'name') p.fail('Identifier expected.')
  let name = jsxIdentifier(p)
  if (p.is(':')) {
    p.next('jsxName')
    const local = jsxIdentifier(p)
    name = p.node('JSXNamespacedName', start, { namespace: name, name: local })
  }
  const value = p.is('=') ? parseAttributeValue(p) : null
  return p.node('JSXAttribute', start, { name, value })
}

/**
 * Parses an attribute's value, from its `=`: a string, an expression container or an element.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseAttributeValue(p: Parser): Node {
  p.next('jsxAttribute')
  const token = p.token
  if (token.kind === 'string') {
    p.next()
    const raw = p.text.slice(token.start, token.end)
    // why: an attribute string holds no escapes; only its entities are decoded.
    const value = p.node('Literal', token.start, { value: decodeEntities(raw.slice(1, -1)), raw })
    if (p.token.kind === 'name') p.scanner.scanJsxName()
    return value
  }
  if (token.kind === 'punct' && token.value === '{') return parseContainer(p, 'jsxName')
  if (token.kind === 'punct' && token.value === '<') return parseJsxElement(p, false)
  return p.fail('JSX value should be either an expression or a quoted JSX text.')
}

/**
 * Parses an expression container, from its `{`.
 *
 * @param p - The parser
 * @param after - How the token after the closing brace is scanned
 * @returns The node built
 */
function parseContainer(p: Parser, after: ScanMode): Node {
  const start = p.next().start
  if (p.is('}')) {
    const emptyStart = p.lastEnd
    p.expect('}', after)
    const expression = p.node('JSXEmptyExpression', emptyStart)
    expression.end = p.lastEnd - 1
    return p.node('JSXExpressionContainer', start, { expression })
  }
  if (p.is('...')) {
    p.next()
    const expression = parseExpression(p)
    p.expect('}', after)
    return p.node('JSXSpreadChild', start, { expression })
  }
  const expression = parseExpression(p)
  p.expect('}', after)
  return p.node('JSXExpressionContainer', start, { expression })
}

/**
 * Parses the children of an element or fragment, up to its closing tag's `<`.
 *
 * @param p - The parser
 * @param tag - The element's tag name, or null for a fragment
 * @returns The nodes built, in source order
 */
function parseChildren(p: Parser, tag: string | null): Node[] {
  const children: Node[] = []
  for (;;) {
    const token = p.token
    if (token.kind === 'eof')
      p.fail(tag === null ? 'JSX fragment has no corresponding closing tag.' : `JSX element '${tag}' has no corresponding closing tag.`)
    if (token.kind === 'jsxtext') {
      p.next('jsxChild')
      const raw = p.text.slice(token.start, token.end)
      children.push(p.node('JSXText', token.start, { value: decodeEntities(raw), raw }))
    } else if (token.kind === 'punct' && token.value === '{') children.push(parseContainer(p, 'jsxChild'))
    else if (token.kind === 'punct' && token.value === '<') {
      if (p.text[token.end] === '/') return children
      children.push(parseJsxElement(p, true))
    }
  }
}

/**
 * Decodes the character entities of JSX text.
 *
 * @param raw - The text as written
 * @returns The text as read
 */
function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x')) return fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return fromCodePoint(Number(entity.slice(1)))
    return ENTITIES[entity] ?? match
  })
}
