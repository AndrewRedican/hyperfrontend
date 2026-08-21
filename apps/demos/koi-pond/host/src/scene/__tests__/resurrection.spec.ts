import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createResurrection } from '../resurrection'
import type { Resurrection, ResurrectionNote } from '../resurrection'

/** The grace before the first reopen. */
const FIRST_DELAY_MS = 4000

/** The grace before the second reopen in the same episode. */
const SECOND_DELAY_MS = 12_000

/** The grace before the third reopen in the same episode. */
const THIRD_DELAY_MS = 36_000

/** How long a revived koi must stay for its budget to come back. */
const STABLE_MS = 60_000

/** Every policy built in a test, so no timer or listener outlives it. */
const policies: Resurrection[] = []

/** Builds a policy over a controllable pond. */
function harness(present = () => false) {
  const reopened: string[] = []
  const notes: { kind: ResurrectionNote; detail: string }[] = []
  const policy = createResurrection({
    isPresent: present,
    reopen: (framework) => {
      reopened.push(framework)
    },
    note: (_framework, kind, detail) => {
      notes.push({ kind, detail })
    },
  })
  policies.push(policy)
  return { policy, reopened, notes }
}

/** Pins `document.hidden` for one test. */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const policy of policies.splice(0)) {
    policy.dispose()
  }
  Reflect.deleteProperty(document, 'hidden')
  vi.useRealTimers()
})

describe('the resurrection policy', () => {
  it('reopens a koi that is still absent once the grace runs out', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS - 1)
    expect(reopened).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(reopened).toEqual(['react'])
  })

  it('leaves a koi alone that answered again during the grace', () => {
    const { policy, reopened, notes } = harness(() => true)
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('recovered')
  })

  it('waits longer for each further death in the same episode', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.frameDied('react')
    vi.advanceTimersByTime(SECOND_DELAY_MS - 1)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(reopened).toHaveLength(2)
  })

  it('stops insisting once the episode has spent its attempts', () => {
    const { policy, reopened, notes } = harness()
    for (const delay of [FIRST_DELAY_MS, SECOND_DELAY_MS, THIRD_DELAY_MS]) {
      policy.frameDied('react')
      vi.advanceTimersByTime(delay)
    }
    expect(reopened).toHaveLength(3)
    policy.frameDied('react')
    vi.advanceTimersByTime(THIRD_DELAY_MS * 3)
    expect(reopened).toHaveLength(3)
    expect(notes.map((note) => note.kind)).toContain('exhausted')
  })

  it('keeps a reopen owed to a hidden page and re-runs the grace when the visitor returns', () => {
    const { policy, reopened, notes } = harness()
    policy.frameDied('react')
    setHidden(true)
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('deferred')
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reopened).toHaveLength(0)
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toEqual(['react'])
  })

  it('spares a frame that recovered while the page was hidden', () => {
    let present = false
    const { policy, reopened, notes } = harness(() => present)
    policy.frameDied('react')
    setHidden(true)
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    setHidden(false)
    // why: The watchdog cannot speak health while the page is hidden, so presence only returns after the page does — the re-run grace is what gives it the chance.
    present = true
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('recovered')
  })

  it('makes a grace recovery earn the budget back the same way a reopen does', () => {
    let present = false
    const { policy, reopened } = harness(() => present)
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.opened('react')
    policy.frameDied('react')
    present = true
    vi.advanceTimersByTime(SECOND_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.frameDied('react')
    present = false
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(SECOND_DELAY_MS - FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('restores the attempt budget once a revived koi has stayed a while', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.opened('react')
    vi.advanceTimersByTime(STABLE_MS)
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('keeps counting the same episode when the koi dies inside the stability window', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.opened('react')
    vi.advanceTimersByTime(STABLE_MS - 1)
    policy.frameDied('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(SECOND_DELAY_MS - FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('lets a fresh open supersede a reopen still waiting', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    policy.opened('react')
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(reopened).toHaveLength(0)
  })

  it('tracks each koi on its own budget', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react')
    policy.frameDied('lit')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened.sort()).toEqual(['lit', 'react'])
  })
})
