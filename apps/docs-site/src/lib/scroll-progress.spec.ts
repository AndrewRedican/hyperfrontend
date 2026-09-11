import { afterEach, describe, expect, it, vi } from 'vitest'
import { readScrollProgress, trackScrollProgress } from './scroll-progress'

/** Props for {@link fakeWindow}. */
interface FakeWindowOptions {
  /** How far down the page the reader is */
  scrollY: number
  /** The height of the whole document */
  scrollHeight: number
  /** The height of the window the document is read in */
  innerHeight: number
}

/**
 * The three measurements {@link readScrollProgress} takes, and nothing else.
 *
 * A window is not constructible and jsdom's own one cannot be given a document
 * height, so the function is handed the smallest object that answers what it
 * asks. Every field it reads is here; anything it reached for that is not
 * would fail loudly rather than silently returning zero.
 *
 * @param options - See {@link FakeWindowOptions}.
 * @returns Something shaped enough like a window for the reader to measure.
 */
function fakeWindow(options: FakeWindowOptions): Window {
  const { scrollY, scrollHeight, innerHeight } = options
  return { scrollY, innerHeight, document: { documentElement: { scrollHeight } } } as unknown as Window
}

describe('readScrollProgress', () => {
  it('is zero at the top of a long page and one at its end', () => {
    const long = { scrollHeight: 16_000, innerHeight: 900 }

    expect(readScrollProgress(fakeWindow({ ...long, scrollY: 0 }))).toBe(0)
    expect(readScrollProgress(fakeWindow({ ...long, scrollY: 15_100 }))).toBe(1)
  })

  it('tracks the fraction of the page in between', () => {
    const halfway = readScrollProgress(fakeWindow({ scrollHeight: 16_000, innerHeight: 900, scrollY: 7_550 }))

    expect(halfway).toBeCloseTo(0.5, 5)
  })

  it('reports nothing for a page that cannot be scrolled at all', () => {
    expect(readScrollProgress(fakeWindow({ scrollHeight: 700, innerHeight: 900, scrollY: 0 }))).toBe(0)
  })

  it('holds a stub page near the top even when it is scrolled to its end', () => {
    // why: three hundred pixels of scrolling is not a descent, and treating it as one would give the shortest documents the deepest treatment
    const end = readScrollProgress(fakeWindow({ scrollHeight: 1_273, innerHeight: 900, scrollY: 373 }))

    expect(end).toBeCloseTo(373 / (3.5 * 900), 5)
    expect(end).toBeLessThan(0.2)
  })

  it('lets a page a few screens long reach the far end of the ramp', () => {
    const end = readScrollProgress(fakeWindow({ scrollHeight: 5_000, innerHeight: 900, scrollY: 4_100 }))

    expect(end).toBeGreaterThan(0.9)
  })

  it('clamps a scroll position past either end of the document', () => {
    const page = { scrollHeight: 16_000, innerHeight: 900 }

    expect(readScrollProgress(fakeWindow({ ...page, scrollY: -240 }))).toBe(0)
    expect(readScrollProgress(fakeWindow({ ...page, scrollY: 99_000 }))).toBe(1)
  })
})

/**
 * Wait for the frame the listener coalesces its work into.
 *
 * @returns A promise resolved after one animation frame.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

describe('trackScrollProgress', () => {
  // why: each case installs its own spies and stubs the document's height, and a spy left standing is a spy the next case counts through
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('publishes the fraction, republishes it on scroll, and clears it on teardown', async () => {
    const stop = trackScrollProgress(window)
    const read = () => document.documentElement.style.getPropertyValue('--page-progress')

    // why: jsdom lays nothing out, so on installation the document has no height to be part of the way down
    expect(read()).toBe('0.00')

    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(10_000)
    window.innerHeight = 1_000
    window.scrollY = 4_500
    window.dispatchEvent(new Event('scroll'))
    await nextFrame()

    expect(read()).toBe('0.50')

    stop()

    expect(read()).toBe('')
  })

  it('writes nothing while the page is still', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(10_000)
    window.innerHeight = 1_000
    window.scrollY = 4_500

    const stop = trackScrollProgress(window)
    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty')

    window.dispatchEvent(new Event('scroll'))
    await nextFrame()
    window.dispatchEvent(new Event('scroll'))
    await nextFrame()

    expect(setProperty).not.toHaveBeenCalled()

    stop()
  })

  it('coalesces a burst of scroll events into one frame of work', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(10_000)
    window.innerHeight = 1_000
    window.scrollY = 0

    const stop = trackScrollProgress(window)
    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty')

    for (const position of [900, 1_800, 2_700, 3_600]) {
      window.scrollY = position
      window.dispatchEvent(new Event('scroll'))
    }
    await nextFrame()

    expect(setProperty).toHaveBeenCalledTimes(1)
    expect(setProperty).toHaveBeenCalledWith('--page-progress', '0.40')

    stop()
  })
})
