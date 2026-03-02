import { deregisterClassTypes } from './deregister-class-types'
import { registerClassTypes } from './register-class-types'
import { registeredClasses } from './shared/consts'

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
    expect(registeredClasses).toHaveLength(2)
    expect(registeredClasses).toContain(A)
    expect(registeredClasses).toContain(C)
    expect(registeredClasses).not.toContain(B)
    expect(registeredClasses).not.toContain(D)
  })

  it('does nothing when called with unregistered class references', () => {
    class E {}
    deregisterClassTypes(E)
    expect(registeredClasses).toHaveLength(4)
    expect(registeredClasses).toContain(A)
    expect(registeredClasses).toContain(B)
    expect(registeredClasses).toContain(C)
    expect(registeredClasses).toContain(D)
  })
})
