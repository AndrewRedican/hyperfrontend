import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { defineProperty, getOwnPropertyDescriptor } from '../built-in-copy/object'
import { locked } from './locked'

interface IContextual {
  method: () => string
  value: string
}

class MockClass implements IContextual {
  value = 'Hello World'

  method() {
    return this.value
  }
}

// why: `@locked() method()` is the authored form, but neither of Node's TypeScript modes parses decorator syntax.
// how: this is what the compiler emits for it, so the subject under test is the same locked prototype method.
defineProperty(
  MockClass.prototype,
  'method',
  locked()(MockClass.prototype, 'method', getOwnPropertyDescriptor(MockClass.prototype, 'method') as PropertyDescriptor)
)

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
