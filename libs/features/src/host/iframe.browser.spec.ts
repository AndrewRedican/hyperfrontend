import { createFeatureIframe, frameReadiness, resolveContainer } from './iframe'

describe('resolveContainer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('throws when no container was supplied', () => {
    expect(() => resolveContainer(undefined)).toThrow('The embedded display mode needs a "container" element or selector to mount into.')
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

  it('keeps the frame transparent so the feature blends into the host page', () => {
    expect(createFeatureIframe('https://feature.example/').getAttribute('allowtransparency')).toBe('true')
  })

  it('pins the frame color scheme to normal so transparency survives a theme mismatch', () => {
    expect(createFeatureIframe('https://feature.example/').style.colorScheme).toBe('normal')
  })

  it('lays the frame out as a block so no inline baseline gap appears', () => {
    expect(createFeatureIframe('https://feature.example/').style.display).toBe('block')
  })

  it('creates the frame hidden so it stays invisible until the shell reveals it', () => {
    expect(createFeatureIframe('https://feature.example/').style.visibility).toBe('hidden')
  })

  it('applies delegated permissions as the allow attribute', () => {
    const iframe = createFeatureIframe('https://feature.example/', { permissions: ['fullscreen', 'clipboard-write'] })
    expect(iframe.getAttribute('allow')).toBe('fullscreen; clipboard-write')
  })

  it('omits the allow attribute when no permissions are delegated', () => {
    expect(createFeatureIframe('https://feature.example/').getAttribute('allow')).toBeNull()
  })

  it('omits the allow attribute for an empty permissions list', () => {
    expect(createFeatureIframe('https://feature.example/', { permissions: [] }).getAttribute('allow')).toBeNull()
  })

  it('omits the sandbox attribute by default', () => {
    expect(createFeatureIframe('https://feature.example/').getAttribute('sandbox')).toBeNull()
  })

  it('omits the sandbox attribute when sandbox is explicitly disabled', () => {
    expect(createFeatureIframe('https://feature.example/', { sandbox: false }).getAttribute('sandbox')).toBeNull()
  })

  it('grants a cross-origin sandboxed frame scripts and its own origin, nothing more', () => {
    const iframe = createFeatureIframe('https://feature.example/', { sandbox: true })
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  })

  it('withholds allow-same-origin from a same-origin sandboxed frame', () => {
    expect(createFeatureIframe('/feature', { sandbox: true }).getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('withholds allow-same-origin when the feature url cannot be parsed', () => {
    expect(createFeatureIframe('https://', { sandbox: true }).getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('maps every sandbox opt-in to its token', () => {
    const iframe = createFeatureIframe('https://feature.example/', {
      sandbox: { forms: true, popups: true, modals: true, downloads: true, topNavigationByUserActivation: true },
    })
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation'
    )
  })

  it('keeps disabled opt-ins denied', () => {
    const iframe = createFeatureIframe('https://feature.example/', {
      sandbox: { forms: false, popups: false, modals: false, downloads: false, topNavigationByUserActivation: false },
    })
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  })
})

describe('frameReadiness', () => {
  it('lets a same-origin frame handshake immediately', () => {
    const iframe = createFeatureIframe('/feature/')
    expect(frameReadiness(iframe, '/feature/')).toBeUndefined()
  })

  it('holds a cross-origin handshake until the frame fires load', () => {
    const iframe = createFeatureIframe('https://feature.example/')
    const begin = jest.fn()
    frameReadiness(iframe, 'https://feature.example/')?.(begin)
    expect(begin).not.toHaveBeenCalled()
    iframe.dispatchEvent(new Event('load'))
    expect(begin).toHaveBeenCalledTimes(1)
  })

  it('begins the handshake only once across repeated load events', () => {
    const iframe = createFeatureIframe('https://feature.example/')
    const begin = jest.fn()
    frameReadiness(iframe, 'https://feature.example/')?.(begin)
    iframe.dispatchEvent(new Event('load'))
    iframe.dispatchEvent(new Event('load'))
    expect(begin).toHaveBeenCalledTimes(1)
  })

  it('never begins a cancelled hold', () => {
    const iframe = createFeatureIframe('https://feature.example/')
    const begin = jest.fn()
    const cancel = frameReadiness(iframe, 'https://feature.example/')?.(begin)
    cancel?.()
    iframe.dispatchEvent(new Event('load'))
    expect(begin).not.toHaveBeenCalled()
  })
})
