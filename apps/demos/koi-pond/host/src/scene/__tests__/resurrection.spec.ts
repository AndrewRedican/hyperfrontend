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
  const page = { hidden: false }
  const policy = createResurrection({
    isPresent: present,
    isHidden: () => page.hidden,
    reopen: (framework) => {
      reopened.push(framework)
    },
    note: (_framework, kind, detail) => {
      notes.push({ kind, detail })
    },
  })
  policies.push(policy)
  return { policy, reopened, notes, page }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const policy of policies.splice(0)) {
    policy.dispose()
  }
  vi.useRealTimers()
})

describe('the resurrection policy', () => {
  it('reopens a koi that is still absent once the grace runs out', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS - 1)
    expect(reopened).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(reopened).toEqual(['react:0'])
  })

  it('leaves a koi alone that answered again during the grace', () => {
    const { policy, reopened, notes } = harness(() => true)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('recovered')
  })

  it('waits longer for each further death in the same episode', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(SECOND_DELAY_MS - 1)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(reopened).toHaveLength(2)
  })

  it('stops insisting once the episode has spent its attempts', () => {
    const { policy, reopened, notes } = harness()
    for (const delay of [FIRST_DELAY_MS, SECOND_DELAY_MS, THIRD_DELAY_MS]) {
      policy.frameDied('react:0')
      vi.advanceTimersByTime(delay)
    }
    expect(reopened).toHaveLength(3)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(THIRD_DELAY_MS * 3)
    expect(reopened).toHaveLength(3)
    expect(notes.map((note) => note.kind)).toContain('exhausted')
  })

  it('keeps a reopen owed to a hidden page and re-runs the grace when the visitor returns', () => {
    const { policy, reopened, notes, page } = harness()
    policy.frameDied('react:0')
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('deferred')
    page.hidden = false
    policy.pageVisible()
    expect(reopened).toHaveLength(0)
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toEqual(['react:0'])
  })

  it('spares a frame that recovered while the page was hidden', () => {
    let present = false
    const { policy, reopened, notes, page } = harness(() => present)
    policy.frameDied('react:0')
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    // why: The watchdog cannot speak health while the page is hidden, so presence only returns after the page does — the re-run grace is what gives it the chance.
    present = true
    policy.pageVisible()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(0)
    expect(notes.map((note) => note.kind)).toContain('recovered')
  })

  it('takes its cue from the pond rather than from the document', () => {
    const { policy, reopened, page } = harness()
    policy.frameDied('react:0')
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(reopened).toHaveLength(0)
  })

  it('makes a grace recovery earn the budget back the same way a reopen does', () => {
    let present = false
    const { policy, reopened } = harness(() => present)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.opened('react:0')
    policy.frameDied('react:0')
    present = true
    vi.advanceTimersByTime(SECOND_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.frameDied('react:0')
    present = false
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(SECOND_DELAY_MS - FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('restores the attempt budget once a revived koi has stayed a while', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    policy.opened('react:0')
    vi.advanceTimersByTime(STABLE_MS)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('keeps counting the same episode when the koi dies inside the stability window', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.opened('react:0')
    vi.advanceTimersByTime(STABLE_MS - 1)
    policy.frameDied('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened).toHaveLength(1)
    vi.advanceTimersByTime(SECOND_DELAY_MS - FIRST_DELAY_MS)
    expect(reopened).toHaveLength(2)
  })

  it('lets a fresh open supersede a reopen still waiting', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    policy.opened('react:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(reopened).toHaveLength(0)
  })

  it('tracks each koi on its own budget', () => {
    const { policy, reopened } = harness()
    policy.frameDied('react:0')
    policy.frameDied('lit:0')
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(reopened.sort()).toEqual(['lit:0', 'react:0'])
  })

  it('keeps twins of one framework on independent budgets', () => {
    const { policy, reopened } = harness()
    // why: One twin burning its whole episode must not spend its sibling's reopens — the budget follows the instance, never the framework.
    for (let episode = 0; episode < 3; episode += 1) {
      policy.frameDied('react:0')
      vi.advanceTimersByTime(THIRD_DELAY_MS)
    }
    policy.frameDied('react:0')
    policy.frameDied('react:1')
    vi.advanceTimersByTime(THIRD_DELAY_MS)
    expect(reopened.filter((id) => id === 'react:1')).toHaveLength(1)
  })
})
