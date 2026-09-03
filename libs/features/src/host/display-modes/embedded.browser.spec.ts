import type { ShellOptions } from '../../shared/types'
import type { ResizeObserverStubController } from '../../testing/resize-observer-stub'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { installResizeObserverStub } from '../../testing/resize-observer-stub'
import { mountEmbedded } from './embedded'

let observers: ResizeObserverStubController

beforeEach(() => {
  observers = installResizeObserverStub()
})

function mount(options: Partial<ShellOptions> = {}) {
  const container = document.createElement('div')
  // how: The rect flips to a sentinel once the iframe is inside, so a presentation carrying the pre-append reading proves the measurement ran before insertion.
  container.getBoundingClientRect = () =>
    container.querySelector('iframe')
      ? ({ width: 999, height: 999 } as unknown as DOMRect)
      : ({ width: 300, height: 200 } as unknown as DOMRect)
  document.body.appendChild(container)
  const result = mountEmbedded({ options: { container, ...options } as ShellOptions, requestClose: jest.fn() })
  return { container, result }
}

describe('mountEmbedded', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('appends an iframe into the container', () => {
    expect(mount({}).container.querySelector('iframe')).not.toBeNull()
  })

  it('loads the provided url into the iframe', () => {
    expect(mount({ url: 'https://feature.example/' }).container.querySelector('iframe')?.src).toBe('https://feature.example/')
  })

  it('targets the iframe content window', () => {
    const { container, result } = mount({})
    expect(result.target).toBe(container.querySelector('iframe')?.contentWindow)
  })

  it('exposes the iframe as the mounted element', () => {
    const { container, result } = mount({})
    expect(result.element).toBe(container.querySelector('iframe'))
  })

  it('announces the embedded mode with the container content box', () => {
    expect(mount({}).result.present).toEqual({ mode: 'embedded', viewport: { width: 300, height: 200 } })
  })

  it('measures the container before the iframe is inserted', () => {
    // note: A post-append measurement would read the 999x999 sentinel instead.
    expect(mount({}).result.present.viewport).toEqual({ width: 300, height: 200 })
  })

  it('mounts the iframe hidden', () => {
    expect(mount({}).container.querySelector('iframe')?.style.visibility).toBe('hidden')
  })

  it('reveals the iframe when the shell asks', () => {
    const { container, result } = mount({})
    result.reveal?.()
    expect(container.querySelector('iframe')?.style.visibility).toBe('visible')
  })

  it('reports the container size through the viewport reporter', () => {
    const report = jest.fn()
    const { container, result } = mount({})
    result.viewport?.start(report)
    observers.resize(container, { width: 320, height: 240 })
    expect(report).toHaveBeenCalledWith({ width: 320, height: 240 })
  })

  it('does not re-send the announced measurement when the reporter starts', () => {
    const report = jest.fn()
    mount({}).result.viewport?.start(report)
    expect(report).not.toHaveBeenCalled()
  })

  it('removes the iframe on cleanup', () => {
    const { container, result } = mount({})
    result.cleanup()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('stops observing the container on cleanup', () => {
    const { container, result } = mount({})
    result.cleanup()
    expect(observers.isObserved(container)).toBe(false)
  })

  it('applies exact pixel dimensions when a fixed footprint is agreed', () => {
    const iframe = mount({ embedWidth: 300, embedHeight: 250 }).container.querySelector('iframe')
    expect({ width: iframe?.style.width, height: iframe?.style.height }).toEqual({ width: '300px', height: '250px' })
  })

  it('provides no viewport reporter for a fixed footprint', () => {
    expect(mount({ embedWidth: 300, embedHeight: 250 }).result.viewport).toBeUndefined()
  })

  it('does not observe the container for a fixed footprint', () => {
    expect(observers.isObserved(mount({ embedWidth: 300, embedHeight: 250 }).container)).toBe(false)
  })

  it('announces the fixed dimensions in the presentation', () => {
    expect(mount({ embedWidth: 300, embedHeight: 250 }).result.present).toEqual({ mode: 'embedded', viewport: { width: 300, height: 250 } })
  })

  it('throws when only the fixed width is set', () => {
    expect(() => mount({ embedWidth: 300 })).toThrow(
      'Fixed embedded sizing needs both "embedWidth" and "embedHeight"; set both or neither.'
    )
  })

  it('throws when only the fixed height is set', () => {
    expect(() => mount({ embedHeight: 250 })).toThrow(
      'Fixed embedded sizing needs both "embedWidth" and "embedHeight"; set both or neither.'
    )
  })

  it('throws when the fixed width is not positive', () => {
    expect(() => mount({ embedWidth: 0, embedHeight: 250 })).toThrow('Fixed embedded dimensions must be positive numbers, but got 0x250.')
  })

  it('throws when the fixed height is not positive', () => {
    expect(() => mount({ embedWidth: 300, embedHeight: -1 })).toThrow('Fixed embedded dimensions must be positive numbers, but got 300x-1.')
  })

  it('delegates the configured permissions to the iframe', () => {
    expect(
      mount({ permissions: ['fullscreen'] })
        .container.querySelector('iframe')
        ?.getAttribute('allow')
    ).toBe('fullscreen')
  })

  it('sandboxes the iframe when a sandbox is configured', () => {
    const { container } = mount({ url: 'https://feature.example/', sandbox: true })
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  })
})
