import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readMockDeclarations } from './mock-declarations'

describe('readMockDeclarations shorthand properties', () => {
  it('names a shorthand property', () => {
    const [declaration] = readMockDeclarations("jest.mock('./dep', () => { const read = 1; return { read } })")
    assert.deepEqual(declaration?.overrides, ['read'])
  })

  it('names both spellings side by side', () => {
    const [declaration] = readMockDeclarations("jest.mock('./dep', () => { const read = 1; return { read, write: 2 } })")
    assert.deepEqual(declaration?.overrides, ['read', 'write'])
  })

  it('does not mistake a longhand value for a shorthand property', () => {
    const [declaration] = readMockDeclarations("jest.mock('./dep', () => { const value = 1; return { read: value } })")
    assert.deepEqual(declaration?.overrides, ['read'])
  })

  it('does not name a spread', () => {
    const [declaration] = readMockDeclarations("jest.mock('./dep', () => ({ ...actual, read: 1 }))")
    assert.deepEqual(declaration?.overrides, ['read'])
  })

  it('leaves a nested literal keys alone', () => {
    const [declaration] = readMockDeclarations("jest.mock('./dep', () => ({ logger: { error, warn } }))")
    assert.deepEqual(declaration?.overrides, ['logger'])
  })
})

describe('readMockDeclarations', () => {
  it('finds nothing in a file that declares no mocks', () => {
    assert.deepEqual(readMockDeclarations('const a = 1\n'), [])
  })

  it('reads the specifier of an automock', () => {
    assert.equal(readMockDeclarations("jest.mock('node:fs')\n")[0]?.specifier, 'node:fs')
  })

  it('leaves the factory undefined for an automock', () => {
    assert.equal(readMockDeclarations("jest.mock('node:fs')\n")[0]?.factory, undefined)
  })

  it('reads a factory written as an arrow returning a literal', () => {
    assert.equal(readMockDeclarations("jest.mock('./a', () => ({ read: 1 }))")[0]?.factory, '() => ({ read: 1 })')
  })

  it('reads the property names a factory defines', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a', () => ({ read: 1, write: 2 }))")[0]?.overrides, ['read', 'write'])
  })

  it('reports a factory that spreads', () => {
    assert.equal(readMockDeclarations("jest.mock('./a', () => ({ ...actual, read: 1 }))")[0]?.spreads, true)
  })

  it('reports a factory that does not spread', () => {
    assert.equal(readMockDeclarations("jest.mock('./a', () => ({ read: 1 }))")[0]?.spreads, false)
  })

  it('reads a multi-line factory with a block body', () => {
    const source = ["jest.mock('./a', () => {", "  const actual = jest.requireActual('./a')", '  return { ...actual, read: 1 }', '})'].join(
      '\n'
    )
    assert.equal(readMockDeclarations(source)[0]?.overrides.join(), 'read')
  })

  it('finds every declaration in a file', () => {
    const source = "jest.mock('./a')\njest.mock('./b', () => ({ x: 1 }))\n"
    assert.deepEqual(
      readMockDeclarations(source).map((entry) => entry.specifier),
      ['./a', './b']
    )
  })

  it('accepts a double-quoted specifier', () => {
    assert.equal(readMockDeclarations('jest.mock("./a")')[0]?.specifier, './a')
  })

  it('ignores a call written inside a template literal', () => {
    assert.deepEqual(readMockDeclarations("const code = `\njest.mock('./a')\n`\n"), [])
  })

  it('ignores a call written inside a string', () => {
    assert.deepEqual(readMockDeclarations('const code = "jest.mock(\'./a\')"\n'), [])
  })

  it('ignores a call written inside a comment', () => {
    assert.deepEqual(readMockDeclarations("// jest.mock('./a')\n"), [])
  })

  it('ignores a call whose specifier is not a literal', () => {
    assert.deepEqual(readMockDeclarations('jest.mock(target, () => ({}))'), [])
  })

  it('ignores a call whose specifier is never closed', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a"), [])
  })

  it('is not confused by a brace inside the factory', () => {
    assert.equal(readMockDeclarations("jest.mock('./a', () => ({ read: () => ({ nested: 1 }) }))")[0]?.specifier, './a')
  })

  it('is not confused by a parenthesis inside a factory string', () => {
    assert.equal(readMockDeclarations("jest.mock('./a', () => ({ read: ')' }))")[0]?.overrides.join(), 'read')
  })

  it('finds a declaration that follows an ignored one', () => {
    assert.equal(readMockDeclarations("// jest.mock('./skipped')\njest.mock('./real')\n")[0]?.specifier, './real')
  })
})

describe('readMockDeclarations nested factories', () => {
  it('ignores the keys of a nested object literal', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a', () => ({ logger: { error: 1, warn: 2 } }))")[0]?.overrides, ['logger'])
  })

  it('ignores the keys of an object inside a returned block body', () => {
    const source = ["jest.mock('./a', () => {", '  return { logger: { error: 1 } }', '})'].join('\n')
    assert.deepEqual(readMockDeclarations(source)[0]?.overrides, ['logger'])
  })

  it('ignores a property of an object passed to a call in the factory', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a', () => ({ read: wrap({ inner: 1 }) }))")[0]?.overrides, ['read'])
  })

  it('reads no names from a factory that returns something other than a literal', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a', () => jest.fn())")[0]?.overrides, [])
  })

  it('reads a key whose value is an arrow function', () => {
    assert.deepEqual(readMockDeclarations("jest.mock('./a', () => ({ read: () => 1, write: () => 2 }))")[0]?.overrides, ['read', 'write'])
  })
})
