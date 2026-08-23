import type { EmbedResurrection } from '../embed-resurrection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmbedResurrection } from '../embed-resurrection'

// why: The built-in copies capture the real timers when their module loads, which is before any fake clock is installed; deferring to `globalThis` at call time is what puts the policy's waits under the test's control.
vi.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (callback: () => void, delay?: number) => globalThis.setTimeout(callback, delay),
  clearTimeout: (id?: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(id),
}))

/** The grace before the first reopen. */
const FIRST_DELAY_MS = 4000

/** The grace before the second reopen in the same episode. */
const SECOND_DELAY_MS = 12_000

/** The grace before the third reopen in the same episode. */
const THIRD_DELAY_MS = 36_000

/** How long a revived embed must stay for its budget to come back. */
const STABLE_MS = 60_000

/** Every policy built in a test, so no timer outlives it. */
const policies: EmbedResurrection[] = []

/**
 * Builds a policy over a controllable embed.
 *
 * @param present - Whether the session is answering, read on every grace.
 * @returns The policy, the seam calls it made in order, and the page's visibility.
 */
function harness(present = () => false) {
  const calls: string[] = []
  const page = { hidden: false }
  const policy = createEmbedResurrection({
    isPresent: present,
    isHidden: () => page.hidden,
    destroy: () => {
      calls.push('destroy')
    },
    open: () => {
      calls.push('open')
    },
    gaveUp: () => {
      calls.push('gaveUp')
    },
  })
  policies.push(policy)
  return { policy, calls, page }
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

describe('the embed resurrection policy', () => {
  it('empties the mount before reopening a session that is still absent', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('leaves the dead mount alone until the grace has run', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS - 1)
    expect(calls).toEqual([])
  })

  it('spares a session that answered during the grace', () => {
    const { policy, calls } = harness(() => true)
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual([])
  })

  it('waits longer for each further death in the same episode', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.frameDied()
    vi.advanceTimersByTime(SECOND_DELAY_MS - 1)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('reopens a second time once the longer wait has run', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.frameDied()
    vi.advanceTimersByTime(SECOND_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open', 'destroy', 'open'])
  })

  it('gives the mount up once the episode has spent its attempts', () => {
    const { policy, calls } = harness()
    for (const delay of [FIRST_DELAY_MS, SECOND_DELAY_MS, THIRD_DELAY_MS]) {
      policy.frameDied()
      vi.advanceTimersByTime(delay)
    }
    policy.frameDied()
    vi.advanceTimersByTime(THIRD_DELAY_MS * 3)
    expect(calls).toEqual(['destroy', 'open', 'destroy', 'open', 'destroy', 'open', 'destroy', 'gaveUp'])
  })

  it('holds a reopen owed to a hidden page', () => {
    const { policy, calls, page } = harness()
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual([])
  })

  it('runs the grace again from the return rather than reopening blind', () => {
    const { policy, calls, page } = harness()
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    policy.pageVisible()
    vi.advanceTimersByTime(FIRST_DELAY_MS - 1)
    expect(calls).toEqual([])
  })

  it('reopens once the returning visitor has given the frame its grace', () => {
    const { policy, calls, page } = harness()
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    policy.pageVisible()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('reopens on a return the browser never announced', () => {
    const { policy, calls, page } = harness()
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('still owes the grace on the wait that re-read the page itself', () => {
    const { policy, calls, page } = harness()
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual([])
  })

  it('spares a session that recovered while the page was hidden', () => {
    let present = false
    const { policy, calls, page } = harness(() => present)
    policy.frameDied()
    page.hidden = true
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    page.hidden = false
    // why: The watchdog speaks no health to a page it cannot watch, so presence only returns after the page does — the re-run grace is what gives it the chance.
    present = true
    policy.pageVisible()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual([])
  })

  it('restores the attempt budget once a revived session has stayed a while', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.opened()
    vi.advanceTimersByTime(STABLE_MS)
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open', 'destroy', 'open'])
  })

  it('keeps counting the same episode when the session dies inside the stability window', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.opened()
    vi.advanceTimersByTime(STABLE_MS - 1)
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('makes a grace recovery earn the budget back the same way a reopen does', () => {
    let present = false
    const { policy, calls } = harness(() => present)
    policy.frameDied()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    policy.opened()
    policy.frameDied()
    present = true
    vi.advanceTimersByTime(SECOND_DELAY_MS)
    policy.frameDied()
    present = false
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(calls).toEqual(['destroy', 'open'])
  })

  it('lets a fresh open supersede a reopen still waiting', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    policy.opened()
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(calls).toEqual([])
  })

  it('takes a page return it owes nothing to as no news at all', () => {
    const { policy, calls } = harness()
    policy.pageVisible()
    vi.advanceTimersByTime(FIRST_DELAY_MS * 2)
    expect(calls).toEqual([])
  })

  it('releases a pending reopen when the embed is torn down', () => {
    const { policy, calls } = harness()
    policy.frameDied()
    policy.dispose()
    vi.advanceTimersByTime(FIRST_DELAY_MS * 3)
    expect(calls).toEqual([])
  })
})
