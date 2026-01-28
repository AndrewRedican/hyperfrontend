import { locked } from './locked'

interface IContextual {
  method: () => string
  value: string
}

class MockClass implements IContextual {
  value = 'Hello World'

  @locked() method() {
    return this.value
  }
}

describe('lockeded classic prototype method', () => {
  let instance: MockClass, otherInstance: Partial<IContextual>

  beforeEach(() => {
    instance = new MockClass()
    otherInstance = { value: 'Foo bar' }
  })

  it('returns expected value', () => {
    expect(instance.method()).toEqual(instance.value)
  })

  it('cannot be modified', () => {
    expect(() => (instance.method = () => '')).toThrow()
  })

  it('remains bound to original context', () => {
    otherInstance.method = instance.method
    expect(otherInstance.method()).toEqual(instance.value)
  })

  it('caches the bound function per instance', () => {
    const firstCall = instance.method()
    expect(firstCall).toEqual(instance.value)

    const secondCall = instance.method()
    expect(secondCall).toEqual(instance.value)

    expect(instance.method).toBe(instance.method)
  })
})
