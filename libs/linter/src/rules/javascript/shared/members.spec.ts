import type { Node } from '../../../code/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../../../code/parse'
import { isMemberAccess, skipChain, staticPropertyName } from './members'

/**
 * The expression of a text's first statement.
 *
 * @param text - One expression statement
 * @returns Its expression
 */
function expressionOf(text: string): Node {
  return ((parseCode(text, '.ts').tree as Node).body as readonly Node[])[0]?.expression as Node
}

describe('skipChain', () => {
  it('unwraps a chain expression', () => {
    expect(skipChain(expressionOf('a?.b')).kind).toBe('MemberExpression')
  })

  it('answers any other node as it is', () => {
    expect(skipChain(expressionOf('a.b')).kind).toBe('MemberExpression')
  })
})

describe('staticPropertyName', () => {
  it('reads a dotted name', () => {
    expect(staticPropertyName(expressionOf('a.b'))).toBe('b')
  })

  it('reads nothing from a private name', () => {
    const method = (((parseCode('class C { #b; m() { return this.#b } }', '.ts').tree as Node).body as readonly Node[])[0]?.body as Node)
      .body as readonly Node[]
    const statement = (((method[1] as Node).value as Node).body as Node).body as readonly Node[]
    expect(staticPropertyName((statement[0] as Node).argument as Node)).toBeNull()
  })

  it('reads a string key', () => {
    expect(staticPropertyName(expressionOf("a['b']"))).toBe('b')
  })

  it('reads a number key', () => {
    expect(staticPropertyName(expressionOf('a[1]'))).toBe('1')
  })

  it('reads nothing from a null key', () => {
    expect(staticPropertyName(expressionOf('a[null]'))).toBeNull()
  })

  it('reads a template key without substitutions', () => {
    expect(staticPropertyName(expressionOf('a[`b`]'))).toBe('b')
  })

  it('reads nothing from a template key with substitutions', () => {
    expect(staticPropertyName(expressionOf('a[`${b}`]'))).toBeNull()
  })

  it('reads nothing from an identifier key', () => {
    expect(staticPropertyName(expressionOf('a[b]'))).toBeNull()
  })
})

describe('isMemberAccess', () => {
  it('recognises the access through a chain', () => {
    expect(isMemberAccess(expressionOf('Number?.NaN'), 'Number', 'NaN')).toBe(true)
  })

  it('rejects a node that is no member expression', () => {
    expect(isMemberAccess(expressionOf('NaN'), 'Number', 'NaN')).toBe(false)
  })

  it('rejects another object', () => {
    expect(isMemberAccess(expressionOf('foo.NaN'), 'Number', 'NaN')).toBe(false)
  })

  it('rejects an object that is no identifier', () => {
    expect(isMemberAccess(expressionOf('a.Number.NaN'), 'Number', 'NaN')).toBe(false)
  })

  it('rejects another property', () => {
    expect(isMemberAccess(expressionOf('Number.Nan'), 'Number', 'NaN')).toBe(false)
  })

  it('accepts any object when none is named', () => {
    expect(isMemberAccess(expressionOf('a.b.apply'), null, 'apply')).toBe(true)
  })
})
