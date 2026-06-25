import { createFeatureIframe, resolveContainer } from './iframe'

describe('resolveContainer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns the element when given one directly', () => {
    const element = document.createElement('div')
    expect(resolveContainer(element)).toBe(element)
  })

  it('resolves a selector to its element', () => {
    const element = document.createElement('div')
    element.id = 'container'
    document.body.appendChild(element)
    expect(resolveContainer('#container')).toBe(element)
  })

  it('throws when the selector matches nothing', () => {
    expect(() => resolveContainer('#missing')).toThrow('container not found')
  })
})

describe('createFeatureIframe', () => {
  it('points the iframe at the feature url', () => {
    expect(createFeatureIframe('https://feature.example/').src).toBe('https://feature.example/')
  })

  it('stretches the iframe to fill its container', () => {
    expect(createFeatureIframe('https://feature.example/').style.width).toBe('100%')
  })
})
