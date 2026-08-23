import { ControlType } from '../shared/control'
import { createVisibilityReporter } from './visibility'

function setVisibilityState(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
}

describe('createVisibilityReporter', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('sends the current visibility on start', () => {
    const send = jest.fn()
    const reporter = createVisibilityReporter(send)
    reporter.start()
    expect(send).toHaveBeenCalledWith(ControlType.Visibility, { hidden: false })
    reporter.stop()
  })

  it('sends again when the page hides', () => {
    const send = jest.fn()
    const reporter = createVisibilityReporter(send)
    reporter.start()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenLastCalledWith(ControlType.Visibility, { hidden: true })
    reporter.stop()
  })

  it('sends each state once', () => {
    const send = jest.fn()
    const reporter = createVisibilityReporter(send)
    reporter.start()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(2)
    reporter.stop()
  })

  it('does not double-subscribe when started twice', () => {
    const send = jest.fn()
    const reporter = createVisibilityReporter(send)
    reporter.start()
    reporter.start()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(2)
    reporter.stop()
  })

  it('stops reporting after stop', () => {
    const send = jest.fn()
    const reporter = createVisibilityReporter(send)
    reporter.start()
    reporter.stop()
    reporter.stop()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(1)
  })
})
