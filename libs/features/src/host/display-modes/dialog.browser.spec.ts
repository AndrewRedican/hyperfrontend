import type { ShellOptions } from '../../shared/types'
import type { ResizeObserverStubController } from '../../testing/resize-observer-stub'
import { installResizeObserverStub } from '../../testing/resize-observer-stub'
import { mountDialog } from './dialog'

let observers: ResizeObserverStubController

beforeEach(() => {
  observers = installResizeObserverStub()
})

function mount(options: Partial<ShellOptions> = {}) {
  const requestClose = jest.fn()
  const result = mountDialog({ options: { url: 'https://feature.example/', ...options } as ShellOptions, requestClose })
  const iframe = document.body.querySelector('iframe') as HTMLIFrameElement
  return { result, iframe, requestClose }
}

const paneViewport = () => ({ width: window.innerWidth, height: window.innerHeight })

describe('mountDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('appends a single pane iframe to the body', () => {
    mount({})
    expect(Array.from(document.body.children).map((child) => child.tagName)).toEqual(['IFRAME'])
  })

  it('renders no backdrop or close button', () => {
    mount({})
    expect({ divs: document.querySelector('div'), buttons: document.querySelector('button') }).toEqual({ divs: null, buttons: null })
  })

  it('fixes the pane across the full viewport', () => {
    const { iframe } = mount({})
    expect({ position: iframe.style.position, inset: iframe.style.inset }).toEqual({ position: 'fixed', inset: '0' })
  })

  it('layers the pane above the host UI', () => {
    expect(mount({}).iframe.style.zIndex).toBe('2147483647')
  })

  it('keeps the pane transparent so the host page shows through', () => {
    expect(mount({}).iframe.getAttribute('allowtransparency')).toBe('true')
  })

  it('mounts the pane hidden', () => {
    expect(mount({}).iframe.style.visibility).toBe('hidden')
  })

  it('reveals the pane when the shell asks', () => {
    const { result, iframe } = mount({})
    result.reveal?.()
    expect(iframe.style.visibility).toBe('visible')
  })

  it('loads the provided url into the pane iframe', () => {
    expect(mount({}).iframe.src).toBe('https://feature.example/')
  })

  it('defaults the iframe url to empty when omitted', () => {
    expect(mount({ url: undefined }).iframe.getAttribute('src')).toBe('')
  })

  it('delegates the configured permissions to the pane iframe', () => {
    expect(mount({ permissions: ['clipboard-write'] }).iframe.getAttribute('allow')).toBe('clipboard-write')
  })

  it('sandboxes the pane iframe when a sandbox is configured', () => {
    expect(mount({ sandbox: true }).iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  })

  it('targets the pane iframe content window', () => {
    const { result, iframe } = mount({})
    expect(result.target).toBe(iframe.contentWindow)
  })

  it('exposes the pane iframe as the mounted element', () => {
    const { result, iframe } = mount({})
    expect(result.element).toBe(iframe)
  })

  it('announces the window inner size as the pane viewport by default', () => {
    const { result } = mount({})
    expect(result.present).toEqual({ mode: 'dialog', viewport: paneViewport() })
    expect(result.present).not.toHaveProperty('dialog')
  })

  it('announces agreed inner dialog box dimensions', () => {
    expect(mount({ dialogWidth: 800, dialogHeight: 600 }).result.present).toEqual({
      mode: 'dialog',
      viewport: paneViewport(),
      dialog: { width: 800, height: 600 },
    })
  })

  it('announces a width-only dialog box agreement', () => {
    const { result } = mount({ dialogWidth: 800 })
    expect(result.present).toEqual({ mode: 'dialog', viewport: paneViewport(), dialog: { width: 800 } })
    expect(result.present.dialog).not.toHaveProperty('height')
  })

  it('announces a height-only dialog box agreement', () => {
    const { result } = mount({ dialogHeight: 600 })
    expect(result.present).toEqual({ mode: 'dialog', viewport: paneViewport(), dialog: { height: 600 } })
    expect(result.present.dialog).not.toHaveProperty('width')
  })

  it('announces a position-only dialog box agreement', () => {
    const { result } = mount({ dialogPosition: 'top-left' })
    expect(result.present).toEqual({ mode: 'dialog', viewport: paneViewport(), dialog: { position: 'top-left' } })
  })

  it('seeds the viewport reporter with the window inner size', () => {
    expect(mount({}).result.viewport?.current()).toEqual(paneViewport())
  })

  it('does not re-send the announced pane size when the reporter starts', () => {
    const report = jest.fn()
    mount({}).result.viewport?.start(report)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports pane size changes through the viewport reporter', () => {
    const report = jest.fn()
    const { result, iframe } = mount({})
    result.viewport?.start(report)
    observers.resize(iframe, { width: 800, height: 600 })
    expect(report).toHaveBeenCalledWith({ width: 800, height: 600 })
  })

  it('requests close when Escape is pressed in the host document', () => {
    const { requestClose } = mount({})
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).toHaveBeenCalledTimes(1)
  })

  it('ignores non-Escape keys', () => {
    const { requestClose } = mount({})
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(requestClose).not.toHaveBeenCalled()
  })

  it('does not close on Escape when closeOnEscape is disabled', () => {
    const { requestClose } = mount({ closeOnEscape: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).not.toHaveBeenCalled()
  })

  it('removes the pane iframe on cleanup', () => {
    const { result } = mount({})
    result.cleanup()
    expect(document.body.querySelector('iframe')).toBeNull()
  })

  it('stops observing the pane on cleanup', () => {
    const { result, iframe } = mount({})
    result.cleanup()
    expect(observers.isObserved(iframe)).toBe(false)
  })

  it('detaches the Escape listener on cleanup', () => {
    const { result, requestClose } = mount({})
    result.cleanup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).not.toHaveBeenCalled()
  })
})
