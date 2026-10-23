import type { Node } from '../../../code/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../../../code/parse'
import { suiteDeclaration, testDeclaration } from './tests'

/**
 * The span a declaration reports on in the first call expression statement of a text.
 *
 * @param text - The code
 * @param declaration - The declaration reader tried on the call
 * @returns The reported text, or null when the call declares nothing
 */
const declared = (text: string, declaration: (call: Node) => Node | null): string | null => {
  const program = parseCode(text, '.ts').tree as Node
  const call = ((program.body as readonly Node[])[0] as Node).expression as Node
  const callee = declaration(call)
  return callee === null ? null : text.slice(callee.start, callee.end)
}

describe('testDeclaration', () => {
  it('names a plain test', () => {
    expect(declared("it('x', () => {})", testDeclaration)).toBe('it')
  })
  it('names a modifier chain', () => {
    expect(declared("test.only.skip('x', () => {})", testDeclaration)).toBe('test.only.skip')
  })
  it('names a table call', () => {
    expect(declared("it.only.each([1])('x', () => {})", testDeclaration)).toBe('it.only.each([1])')
  })
  it('names a tagged table', () => {
    expect(declared("xit.each`a`('x', () => {})", testDeclaration)).toBe('xit.each`a`')
  })
  it('passes a suite by', () => {
    expect(declared("describe('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a computed modifier by', () => {
    expect(declared("it['only']('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes an unknown modifier by', () => {
    expect(declared("it.fails('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a member rooted elsewhere by', () => {
    expect(declared("suite.it('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a table call rooted in a call by', () => {
    expect(declared("make().each([1])('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a table call without each by', () => {
    expect(declared("it.only([1])('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a bare each by', () => {
    expect(declared("each([1])('x', () => {})", testDeclaration)).toBe(null)
  })
  it('passes a sequence callee by', () => {
    expect(declared("(0, it)('x', () => {})", testDeclaration)).toBe(null)
  })
})

describe('suiteDeclaration', () => {
  it('names a suite', () => {
    expect(declared("describe.each([1])('x', () => {})", suiteDeclaration)).toBe('describe.each([1])')
  })
  it('passes a test by', () => {
    expect(declared("it('x', () => {})", suiteDeclaration)).toBe(null)
  })
})
