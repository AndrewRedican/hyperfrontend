import { describe, expect, it } from '@hyperfrontend/testing'
import { globalNameOf, scopeOf, scopedName, unscopedName } from './scope'

describe('scopeOf', () => {
  it.each([
    ['@acme/core', '@acme'],
    ['core', undefined],
    ['@lonely', undefined],
  ])('reads the scope of %s as %s', (packageName, scope) => {
    expect(scopeOf(packageName)).toBe(scope)
  })
})

describe('unscopedName', () => {
  it.each([
    ['@acme/core', 'core'],
    ['core', 'core'],
  ])('reads the name of %s as %s', (packageName, name) => {
    expect(unscopedName(packageName)).toBe(name)
  })
})

describe('scopedName', () => {
  it('joins a scope and a name', () => {
    expect(scopedName('@acme', 'core')).toBe('@acme/core')
  })

  it('keeps a name alone without a scope', () => {
    expect(scopedName(undefined, 'core')).toBe('core')
  })
})

describe('globalNameOf', () => {
  it.each([
    ['@hyperfrontend/my-utils', 'HyperfrontendMyUtils'],
    ['@acme/core', 'AcmeCore'],
    ['plain-lib', 'PlainLib'],
  ])('names the global of %s %s', (packageName, globalName) => {
    expect(globalNameOf(packageName)).toBe(globalName)
  })
})
