import { afterEach, describe, expect, it } from 'vitest'
import { createVisibilityWatch } from '../visibility'
import type { VisibilitySource, VisibilityWatch } from '../visibility'

/** How often the watch re-reads the browser's own visibility. */
const POLL_INTERVAL_MS = 2000

/** Every watch built in a test, so no probe frame or poll outlives it. */
const watches: VisibilityWatch[] = []

/** A hand-driven browser: visibility, announcements, frames and the poll all move only when a test says so. */
function browser(startHidden = false) {
  const applied: { hidden: boolean; source: VisibilitySource }[] = []
  const state = { hidden: startHidden, listeners: 0, polls: 0, frames: 0 }
  let listener: (() => void) | null = null
  let onPoll: (() => void) | null = null
  let onFrame: (() => void) | null = null

  const watch = createVisibilityWatch(
    { apply: (hidden, source) => applied.push({ hidden, source }) },
    {
      isHidden: () => state.hidden,
      listen: (handler) => {
        listener = handler
        state.listeners += 1
        return () => {
          state.listeners -= 1
        }
      },
      requestFrame: (callback) => {
        onFrame = callback
        state.frames += 1
        return state.frames
      },
      cancelFrame: () => {
        onFrame = null
      },
      setPoll: (callback, everyMs) => {
        onPoll = callback
        state.polls = everyMs
        return 1
      },
      clearPoll: () => {
        state.polls = 0
      },
    }
  )
  watches.push(watch)

  return {
    watch,
    applied,
    state,
    /** Flips what the browser reports, saying nothing about it. */
    silently(hidden: boolean) {
      state.hidden = hidden
    },
    /** Flips what the browser reports and announces it, as a delivered event does. */
    announce(hidden: boolean) {
      state.hidden = hidden
      listener?.()
    },
    /** Runs one reconciliation poll. */
    poll() {
      onPoll?.()
    },
    /** Serves one animation frame. */
    frame() {
      const pending = onFrame
      onFrame = null
      pending?.()
    },
    /** Whether a probe frame is outstanding. */
    get probing() {
      return onFrame !== null
    },
  }
}

afterEach(() => {
  for (const watch of watches.splice(0)) {
    watch.dispose()
  }
})

describe('the visibility watch', () => {
  it('applies an announced hide', () => {
    const page = browser()
    page.announce(true)
    expect(page.applied).toEqual([{ hidden: true, source: 'event' }])
  })

  it('wakes on the first frame served after a visible edge nobody announced', () => {
    const page = browser()
    page.announce(true)
    page.silently(false)
    page.frame()
    expect(page.applied).toEqual([expect.objectContaining({ hidden: true }), { hidden: false, source: 'frame' }])
  })

  it('wakes on the poll when the state flips with no announcement and no frame', () => {
    const page = browser()
    page.announce(true)
    page.silently(false)
    page.poll()
    expect(page.applied).toEqual([expect.objectContaining({ hidden: true }), { hidden: false, source: 'poll' }])
  })

  it('keeps sleeping through a frame served while the browser still calls the page hidden', () => {
    const page = browser()
    page.announce(true)
    page.frame()
    expect(page.applied).toEqual([expect.objectContaining({ hidden: true })])
  })

  it('keeps probing after a frame that settled nothing', () => {
    const page = browser()
    page.announce(true)
    page.frame()
    expect(page.probing).toBe(true)
  })

  it('corrects a hide the browser never announced', () => {
    const page = browser()
    page.silently(true)
    page.poll()
    expect(page.applied).toEqual([{ hidden: true, source: 'poll' }])
  })

  it('asks for no frames at all while the pond is awake', () => {
    const page = browser()
    page.poll()
    expect(page.state.frames).toBe(0)
  })

  it('says nothing when an announcement agrees with the state already applied', () => {
    const page = browser()
    page.announce(true)
    page.announce(true)
    expect(page.applied).toHaveLength(1)
  })

  it('says nothing more once a wake has been applied', () => {
    const page = browser()
    page.announce(true)
    page.silently(false)
    page.frame()
    page.poll()
    page.announce(false)
    expect(page.applied).toHaveLength(2)
  })

  it('stops probing once the pond is awake', () => {
    const page = browser()
    page.announce(true)
    page.silently(false)
    page.frame()
    expect(page.probing).toBe(false)
  })

  it('probes from the start when the pond opens into a hidden page', () => {
    const page = browser(true)
    expect(page.probing).toBe(true)
  })

  it('reads back the state the pond has acted on', () => {
    const page = browser()
    page.announce(true)
    expect(page.watch.hidden).toBe(true)
  })

  it('releases the listener, the poll and the probe frame on dispose', () => {
    const page = browser(true)
    page.watch.dispose()
    expect({ listeners: page.state.listeners, polls: page.state.polls, probing: page.probing }).toEqual({
      listeners: 0,
      polls: 0,
      probing: false,
    })
  })

  it('polls on the interval the watch asked for', () => {
    expect(browser().state.polls).toBe(POLL_INTERVAL_MS)
  })
})
