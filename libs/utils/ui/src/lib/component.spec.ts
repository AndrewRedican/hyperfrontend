/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StyleFn } from './component'
import { component } from './component'
import { span } from './element-creators'

describe('component', () => {
  let style: StyleFn
  let create: any

  beforeEach(() => {
    style = jest.fn()
    create = jest.fn()
  })

  it('creates an element and applies style only once', () => {
    create.mockImplementation(() => {
      return { ref: document.createElement('span') }
    })
    const testComponent = component(create, style)
    const result1 = testComponent()
    const result2 = testComponent()
    expect(style).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(result1).toBe(result2)
  })

  it('returns an element with correct configuration', () => {
    const testNumber = 5
    const style = () => <any>[]
    const createComponent = component<HTMLSpanElement, [number]>((number) => {
      const element = span({ className: 'test-class' })
      element.ref.innerText = `${number}`
      return element
    }, style)
    const instance = createComponent(testNumber)
    expect(instance.ref.innerText).toBe(testNumber.toString())
    expect(instance.ref.className).toBe('test-class')
  })

  it('works without style function', () => {
    const createComponent = component(() => {
      return span({ className: 'no-style' })
    })
    const instance = createComponent()
    expect(instance.ref.className).toBe('no-style')
  })
})
