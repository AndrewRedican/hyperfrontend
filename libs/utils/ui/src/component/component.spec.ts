/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StyleFn } from './component'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { span } from '../element'
import { component } from './component'

describe('component', () => {
  let style: StyleFn
  let create: any

  beforeEach(() => {
    style = jest.fn()
    create = jest.fn()
  })

  it('applies the style only once across repeated calls', () => {
    create.mockImplementation(() => {
      return { ref: document.createElement('span') }
    })
    const testComponent = component(create, style)
    testComponent()
    testComponent()
    expect(style).toHaveBeenCalledTimes(1)
  })

  it('creates the element only once across repeated calls', () => {
    create.mockImplementation(() => {
      return { ref: document.createElement('span') }
    })
    const testComponent = component(create, style)
    testComponent()
    testComponent()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('returns the same element on repeated calls', () => {
    create.mockImplementation(() => {
      return { ref: document.createElement('span') }
    })
    const testComponent = component(create, style)
    const result1 = testComponent()
    const result2 = testComponent()
    expect(result1).toBe(result2)
  })

  it('returns an element with correct configuration', () => {
    const testNumber = 5
    const style = () => [] as any
    const createComponent = component<HTMLSpanElement, [number]>((number) => {
      const element = span({ className: 'test-class' })
      element.ref.innerText = `${number}`
      return element
    }, style)
    const instance = createComponent(testNumber)
    expect({ innerText: instance.ref.innerText, className: instance.ref.className }).toEqual({
      innerText: testNumber.toString(),
      className: 'test-class',
    })
  })

  it('works without style function', () => {
    const createComponent = component(() => {
      return span({ className: 'no-style' })
    })
    const instance = createComponent()
    expect(instance.ref.className).toBe('no-style')
  })
})
