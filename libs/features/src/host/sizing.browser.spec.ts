import type { ResizeObserverStubController } from '../testing/resize-observer-stub'
import { installResizeObserverStub } from '../testing/resize-observer-stub'
import { createContainerReporter, createObserverReporter, measureContentBox } from './sizing'

let observers: ResizeObserverStubController

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

beforeEach(() => {
  observers = installResizeObserverStub()
})

describe('measureContentBox', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function measuredElement(rect: { width: number; height: number }, style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => ({ width: rect.width, height: rect.height }) as unknown as DOMRect
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      borderLeftWidth: '',
      borderRightWidth: '',
      borderTopWidth: '',
      borderBottomWidth: '',
      paddingLeft: '',
      paddingRight: '',
      paddingTop: '',
      paddingBottom: '',
      ...style,
    } as unknown as CSSStyleDeclaration)
    return element
  }

  it('subtracts borders and padding from the border-box rect on both axes', () => {
    const element = measuredElement(
      { width: 300, height: 200 },
      {
        borderLeftWidth: '2px',
        borderRightWidth: '3px',
        borderTopWidth: '1px',
        borderBottomWidth: '2px',
        paddingLeft: '4px',
        paddingRight: '5px',
        paddingTop: '3px',
        paddingBottom: '4px',
      }
    )
    expect(measureContentBox(element)).toEqual({ width: 286, height: 190 })
  })

  it('treats unparsable computed values as zero chrome', () => {
    expect(measureContentBox(measuredElement({ width: 300, height: 200 }))).toEqual({ width: 300, height: 200 })
  })

  it('floors the width at zero when the chrome exceeds the rect', () => {
    const element = measuredElement({ width: 10, height: 200 }, { borderLeftWidth: '8px', paddingRight: '8px' })
    expect(measureContentBox(element)).toEqual({ width: 0, height: 200 })
  })

  it('floors the height at zero when the chrome exceeds the rect', () => {
    const element = measuredElement({ width: 300, height: 6 }, { borderTopWidth: '4px', paddingBottom: '4px' })
    expect(measureContentBox(element)).toEqual({ width: 300, height: 0 })
  })

  it('subtracts fractional chrome without rounding', () => {
    const element = measuredElement({ width: 300.5, height: 200.25 }, { paddingLeft: '0.5px', paddingTop: '0.25px' })
    expect(measureContentBox(element)).toEqual({ width: 300, height: 200 })
  })
})

describe('createObserverReporter', () => {
  let element: HTMLElement

  beforeEach(() => {
    element = document.createElement('iframe')
  })

  it('exposes the seeded size as current', () => {
    expect(createObserverReporter(element, { width: 640, height: 480 }).current()).toEqual({ width: 640, height: 480 })
  })

  it('does not re-send the seeded size on start', () => {
    const report = jest.fn()
    createObserverReporter(element, { width: 640, height: 480 }).start(report)
    expect(report).not.toHaveBeenCalled()
  })

  it('forwards a size change once started', () => {
    const report = jest.fn()
    createObserverReporter(element, { width: 640, height: 480 }).start(report)
    observers.resize(element, { width: 800, height: 600 })
    expect(report.mock.calls).toEqual([[{ width: 800, height: 600 }]])
  })

  it('forwards a height-only change', () => {
    const report = jest.fn()
    createObserverReporter(element, { width: 640, height: 480 }).start(report)
    observers.resize(element, { width: 640, height: 600 })
    expect(report).toHaveBeenCalledWith({ width: 640, height: 600 })
  })

  it('swallows a change that matches what was already announced', () => {
    const report = jest.fn()
    createObserverReporter(element, { width: 640, height: 480 }).start(report)
    observers.resize(element, { width: 640, height: 480 })
    expect(report).not.toHaveBeenCalled()
  })

  it('tracks a change arriving before start and reports it once on start', () => {
    const report = jest.fn()
    const reporter = createObserverReporter(element, { width: 640, height: 480 })
    observers.resize(element, { width: 800, height: 600 })
    expect(reporter.current()).toEqual({ width: 800, height: 600 })
    reporter.start(report)
    expect(report.mock.calls).toEqual([[{ width: 800, height: 600 }]])
  })

  it('stops forwarding and observing after stop', () => {
    const report = jest.fn()
    const reporter = createObserverReporter(element, { width: 640, height: 480 })
    reporter.start(report)
    reporter.stop()
    observers.resize(element, { width: 800, height: 600 })
    expect({ calls: report.mock.calls, observed: observers.isObserved(element) }).toEqual({ calls: [], observed: false })
  })
})

describe('createContainerReporter', () => {
  let container: HTMLElement
  let frame: HTMLIFrameElement

  beforeEach(() => {
    setViewport(1000, 800)
    container = document.createElement('div')
    frame = document.createElement('iframe')
  })

  afterEach(() => {
    setViewport(1024, 768)
  })

  const create = (measured: { width: number; height: number }) => createContainerReporter(container, frame, measured)

  it('exposes the seeded measurement as current', () => {
    expect(create({ width: 300, height: 200 }).current()).toEqual({ width: 300, height: 200 })
  })

  it('leaves the frame styles alone when both seeded axes are real', () => {
    create({ width: 300, height: 200 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '', height: '' })
  })

  it('does not re-send the seeded measurement on start', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports successive container sizes as the container resizes', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    observers.resize(container, { width: 320, height: 240 })
    observers.resize(container, { width: 350, height: 260 })
    expect(report.mock.calls).toEqual([[{ width: 320, height: 240 }], [{ width: 350, height: 260 }]])
  })

  it('passes fractional pixel sizes through exactly', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    observers.resize(container, { width: 300.5, height: 199.25 })
    expect(report).toHaveBeenCalledWith({ width: 300.5, height: 199.25 })
  })

  it('dedupes identical consecutive sizes', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    observers.resize(container, { width: 320, height: 240 })
    observers.resize(container, { width: 320, height: 240 })
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('swallows a resize that echoes the seeded measurement', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    observers.resize(container, { width: 300, height: 200 })
    expect(report).not.toHaveBeenCalled()
  })

  it('tracks a change arriving before start and reports it once on start', () => {
    const report = jest.fn()
    const reporter = create({ width: 300, height: 200 })
    observers.resize(container, { width: 320, height: 240 })
    reporter.start(report)
    expect(report.mock.calls).toEqual([[{ width: 320, height: 240 }]])
  })

  it('applies a fallback height to the frame when the seeded height is zero', () => {
    const reporter = create({ width: 400, height: 0 })
    expect(frame.style.height).toBe('320px')
    expect(reporter.current()).toEqual({ width: 400, height: 320 })
  })

  it('leaves the frame width alone when only the height was missing', () => {
    create({ width: 400, height: 0 })
    expect(frame.style.width).toBe('')
  })

  it('applies a fallback to both axes when both seeded axes are zero', () => {
    const reporter = create({ width: 0, height: 0 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '1000px', height: '720px' })
    expect(reporter.current()).toEqual({ width: 1000, height: 720 })
  })

  it('keeps a real seeded height while the width falls back', () => {
    const reporter = create({ width: 0, height: 250 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '1000px', height: '' })
    expect(reporter.current()).toEqual({ width: 1000, height: 250 })
  })

  it('re-applies the fallback when a later measurement loses an axis', () => {
    const report = jest.fn()
    create({ width: 300, height: 200 }).start(report)
    observers.resize(container, { width: 400, height: 0 })
    expect(frame.style.height).toBe('320px')
    expect(report).toHaveBeenCalledWith({ width: 400, height: 320 })
  })

  it('keeps the fallback while measurements merely echo it', () => {
    const report = jest.fn()
    create({ width: 400, height: 0 }).start(report)
    observers.resize(container, { width: 400, height: 320 })
    expect(frame.style.height).toBe('320px')
    expect(report).not.toHaveBeenCalled()
  })

  it('keeps a both-axes fallback while measurements echo both axes', () => {
    const report = jest.fn()
    create({ width: 0, height: 0 }).start(report)
    observers.resize(container, { width: 1000, height: 720 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '1000px', height: '720px' })
    expect(report).not.toHaveBeenCalled()
  })

  it('retires only the height fallback when a diverging height arrives', () => {
    const report = jest.fn()
    create({ width: 400, height: 0 }).start(report)
    observers.resize(container, { width: 400, height: 500 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '', height: '100%' })
    expect(report).toHaveBeenLastCalledWith({ width: 400, height: 500 })
  })

  it('retires the width fallback while the height fallback stays applied', () => {
    const report = jest.fn()
    create({ width: 0, height: 0 }).start(report)
    observers.resize(container, { width: 600, height: 720 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '100%', height: '720px' })
    expect(report).toHaveBeenLastCalledWith({ width: 600, height: 720 })
  })

  it('retires the remaining height fallback once its own axis diverges', () => {
    const report = jest.fn()
    create({ width: 0, height: 0 }).start(report)
    observers.resize(container, { width: 600, height: 720 })
    observers.resize(container, { width: 600, height: 500 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '100%', height: '100%' })
    expect(report).toHaveBeenLastCalledWith({ width: 600, height: 500 })
  })

  it('retires a width-only fallback without touching the never-applied height', () => {
    const report = jest.fn()
    create({ width: 0, height: 250 }).start(report)
    observers.resize(container, { width: 600, height: 250 })
    expect({ width: frame.style.width, height: frame.style.height }).toEqual({ width: '100%', height: '' })
    expect(report).toHaveBeenLastCalledWith({ width: 600, height: 250 })
  })

  it('stops forwarding and observing after stop', () => {
    const report = jest.fn()
    const reporter = create({ width: 300, height: 200 })
    reporter.start(report)
    observers.resize(container, { width: 320, height: 240 })
    reporter.stop()
    observers.resize(container, { width: 400, height: 300 })
    expect({ calls: report.mock.calls.length, observed: observers.isObserved(container) }).toEqual({ calls: 1, observed: false })
  })
})
