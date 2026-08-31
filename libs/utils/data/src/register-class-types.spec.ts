import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterClassTypes } from './deregister-class-types'
import { registerClassTypes } from './register-class-types'
import { registeredClasses } from './shared/consts'

describe('registerClassTypes', () => {
  beforeEach(() => deregisterClassTypes())

  afterAll(() => deregisterClassTypes())

  it('registers one or more class types', () => {
    class A {}
    class B {}
    registerClassTypes(A, B)
    expect(registeredClasses.length).toBe(2)
    expect(registeredClasses).toContain(A)
    expect(registeredClasses).toContain(B)
  })

  it('ignores subsequent registrations of the same class type', () => {
    class A {}
    registerClassTypes(A)
    registerClassTypes(A)
    expect(registeredClasses.length).toBe(1)
    expect(registeredClasses).toContain(A)
  })
})
