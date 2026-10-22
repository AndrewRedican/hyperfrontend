import { describe, expect, it } from '@hyperfrontend/testing'
import { isIdentifier, isNamepath } from './namepaths.ts'

describe('isNamepath', () => {
  it('accepts a module path with members and an event', () => {
    expect(isNamepath('module:namespace.SomeClass#event:ext_anevent')).toBe(true)
  })

  it('accepts a module path with slashes', () => {
    expect(isNamepath('module:foo/bar')).toBe(true)
  })

  it('accepts quoted segments and array roots', () => {
    expect(isNamepath('cfg."0".items[].name')).toBe(true)
  })

  it('refuses a character a name cannot hold', () => {
    expect(isNamepath('foo%')).toBe(false)
  })

  it('refuses a leading separator', () => {
    expect(isNamepath('#foo')).toBe(false)
  })

  it('refuses a trailing separator', () => {
    expect(isNamepath('Foo~')).toBe(false)
  })

  it('refuses a quote left open', () => {
    expect(isNamepath('a."b')).toBe(false)
  })

  it('refuses a malformed module path', () => {
    expect(isNamepath('module:a//b')).toBe(false)
  })
})

describe('isIdentifier', () => {
  it('refuses a path', () => {
    expect(isIdentifier('module:abc/def')).toBe(false)
  })
})
