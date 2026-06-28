import type { DevManifest } from '../dev-server'
import type { DebugUiHandle } from './app'
import { mountDebugUi } from './app'

const manifest = (over: Partial<DevManifest> = {}): DevManifest => ({
  apps: [{ name: 'clock', url: 'http://localhost:3000/' }],
  debug: { enabled: true, messageLog: true, securityView: true },
  ...over,
})

describe('mountDebugUi', () => {
  let root: HTMLElement
  let handle: DebugUiHandle | undefined

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    handle?.cleanup()
    handle = undefined
    document.body.innerHTML = ''
  })

  const iframe = (): HTMLIFrameElement => <HTMLIFrameElement>root.querySelector('iframe')
  const selects = (): NodeListOf<HTMLSelectElement> => root.querySelectorAll('select')
  const change = (element: HTMLSelectElement, value: string): void => {
    element.value = value
    element.dispatchEvent(new Event('change'))
  }

  it('loads the first app into the iframe', () => {
    handle = mountDebugUi(root, manifest())
    expect(iframe().getAttribute('src')).toBe('http://localhost:3000/')
  })

  it('leaves the iframe src unset when no apps are configured', () => {
    handle = mountDebugUi(root, manifest({ apps: [] }))
    expect(iframe().hasAttribute('src')).toBe(false)
  })

  it('shows the message log when enabled', () => {
    handle = mountDebugUi(root, manifest())
    expect(root.textContent).toEqual(expect.stringContaining('Messages'))
  })

  it('hides the message log when disabled', () => {
    handle = mountDebugUi(root, manifest({ debug: { enabled: true, messageLog: false, securityView: true } }))
    expect(root.textContent).not.toEqual(expect.stringContaining('Messages'))
  })

  it('shows the security readout when enabled', () => {
    handle = mountDebugUi(root, manifest())
    expect(root.textContent).toEqual(expect.stringContaining('protocol: none'))
  })

  it('hides the security readout when disabled', () => {
    handle = mountDebugUi(root, manifest({ debug: { enabled: true, messageLog: true, securityView: false } }))
    expect(root.textContent).not.toEqual(expect.stringContaining('protocol:'))
  })

  it('reflects the chosen display mode on the iframe', () => {
    handle = mountDebugUi(root, manifest())
    change(<HTMLSelectElement>selects()[0], 'dialog')
    expect(iframe().getAttribute('data-display-mode')).toBe('dialog')
  })

  it('resizes the iframe from the width control', () => {
    handle = mountDebugUi(root, manifest())
    const width = <HTMLInputElement>root.querySelectorAll('input[type="number"]')[0]
    width.value = '900'
    width.dispatchEvent(new Event('input'))
    expect(iframe().style.width).toBe('900px')
  })

  it('updates the security readout when the protocol changes', () => {
    handle = mountDebugUi(root, manifest())
    change(<HTMLSelectElement>selects()[1], 'v2')
    expect(root.textContent).toEqual(expect.stringContaining('protocol: v2'))
  })

  it('ignores protocol changes when the security readout is hidden', () => {
    handle = mountDebugUi(root, manifest({ debug: { enabled: true, messageLog: true, securityView: false } }))
    change(<HTMLSelectElement>selects()[1], 'v2')
    expect(root.textContent).not.toEqual(expect.stringContaining('protocol:'))
  })

  it('logs an incoming window message from a served origin', () => {
    handle = mountDebugUi(root, manifest())
    window.dispatchEvent(new MessageEvent('message', { data: { ping: 1 }, origin: 'http://localhost:3000' }))
    expect(root.textContent).toEqual(expect.stringContaining('"ping"'))
  })

  it('ignores a message from an untrusted origin', () => {
    handle = mountDebugUi(root, manifest())
    window.dispatchEvent(new MessageEvent('message', { data: { ping: 1 }, origin: 'http://evil.example.com' }))
    expect(root.textContent).not.toEqual(expect.stringContaining('"ping"'))
  })

  it('trusts no origin when an app url is unparseable', () => {
    handle = mountDebugUi(root, manifest({ apps: [{ name: 'broken', url: 'not-a-url' }] }))
    window.dispatchEvent(new MessageEvent('message', { data: { ping: 1 }, origin: 'http://localhost:3000' }))
    expect(root.textContent).not.toEqual(expect.stringContaining('"ping"'))
  })

  it('marks the feature connected on the first message', () => {
    handle = mountDebugUi(root, manifest())
    window.dispatchEvent(new MessageEvent('message', { data: {}, origin: 'http://localhost:3000' }))
    expect(root.textContent).not.toEqual(expect.stringContaining('disconnected'))
  })

  it('attaches the listener to an injected window', () => {
    handle = mountDebugUi(root, manifest(), { window })
    window.dispatchEvent(new MessageEvent('message', { data: { ping: 1 }, origin: 'http://localhost:3000' }))
    expect(root.textContent).toEqual(expect.stringContaining('"ping"'))
  })

  it('connects without logging when the message log is disabled', () => {
    handle = mountDebugUi(root, manifest({ debug: { enabled: true, messageLog: false, securityView: true } }))
    window.dispatchEvent(new MessageEvent('message', { data: {}, origin: 'http://localhost:3000' }))
    expect(root.textContent).not.toEqual(expect.stringContaining('disconnected'))
  })

  it('detaches the message listener and clears the root on cleanup', () => {
    handle = mountDebugUi(root, manifest())
    handle.cleanup()
    window.dispatchEvent(new MessageEvent('message', { data: { ping: 1 }, origin: 'http://localhost:3000' }))
    expect(root.textContent).toBe('')
  })
})
