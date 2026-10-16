import type { UnknownClass } from './models'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterClassTypes } from './deregister-class-types'
import { registerClassTypes } from './register-class-types'
import { registeredClasses } from './shared/consts'

// why: the registry keeps classes in registration order, which earlier tests in this file reshuffle, so membership is compared in name order.
const byName = (left: UnknownClass, right: UnknownClass): number => left.name.localeCompare(right.name)

describe('deregisterClassTypes', () => {
  class A {}
  class B {}
  class C {}
  class D {}

  beforeEach(() => registerClassTypes(A, B, C, D))

  afterAll(() => deregisterClassTypes())

  it('removes all registered classes when called without arguments', () => {
    deregisterClassTypes()
    expect(registeredClasses).toHaveLength(0)
  })

  it('removes only specified classes when called with class references', () => {
    deregisterClassTypes(B, D)
    expect([...registeredClasses].sort(byName)).toEqual([A, C])
  })

  it('does nothing when called with unregistered class references', () => {
    class E {}
    deregisterClassTypes(E)
    expect([...registeredClasses].sort(byName)).toEqual([A, B, C, D])
  })
})
