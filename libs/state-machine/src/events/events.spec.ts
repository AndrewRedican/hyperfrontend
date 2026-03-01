import type { DerivedState } from '../models'
import { start } from '../actions'
import { Events } from '../events/events'
import { event } from '../models'
import { derivedState } from '../selectors'
import { createInitialState } from '../state'

describe('Events', () => {
  let events: Events

  beforeEach(() => {
    events = new Events()
  })

  it('triggers event handler when event is activated', () => {
    const notStartedHandler = jest.fn()
    const inProgressHandler = jest.fn()

    events.on(event.NotStarted, notStartedHandler)
    events.on(event.InProgress, inProgressHandler)

    events.dispatch(start())
    expect(notStartedHandler).not.toHaveBeenCalled()
    expect(inProgressHandler).toHaveBeenCalled()
  })

  it('does not trigger event handler when event is not activated', () => {
    const notStartedHandler = jest.fn()
    const doneHandler = jest.fn()

    events.on(event.NotStarted, notStartedHandler)
    events.on(event.Done, doneHandler)

    events.dispatch(start())
    expect(notStartedHandler).not.toHaveBeenCalled()
    expect(doneHandler).not.toHaveBeenCalled()
  })

  it('does not trigger event handler if it is not registered', () => {
    const notStartedHandler = jest.fn()
    const doneHandler = jest.fn()

    events.on(event.Done, doneHandler)

    events.dispatch(start())
    expect(notStartedHandler).not.toHaveBeenCalled()
    expect(doneHandler).not.toHaveBeenCalled()
  })

  it('passes correct previous and current derived states to event handler', () => {
    const inProgressHandler = jest.fn()

    events.on(event.InProgress, inProgressHandler)

    expect(inProgressHandler).not.toHaveBeenCalled()

    events.dispatch(start())

    const expectedPrevious = null

    const expectedCurrent: DerivedState = {
      ...derivedState(createInitialState()),
      notStarted: false,
      inProgress: true,
    }

    expect(inProgressHandler).toHaveBeenCalledWith(event.InProgress, expectedCurrent, expectedPrevious)
  })
})
