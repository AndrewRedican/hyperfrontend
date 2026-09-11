import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Custom property the stylesheet reads how far down the page a reader is from. */
const PROGRESS_PROPERTY = '--page-progress'

/**
 * How much the fraction has to move before it is written again.
 *
 * The atmosphere changes across a whole page, so a hundredth of it is well
 * below anything an eye resolves. Rounding to that turns a fast scroll from
 * one property write per frame into a few dozen writes for the whole descent,
 * and each write is what invalidates the paint of two full-viewport layers.
 */
const STEP = 0.01

/**
 * How far a reader has to descend, in screens, before a page reads as fully
 * descended.
 *
 * Progress is a fraction of the page and also a distance, whichever is the
 * smaller, and this is the distance. Without it a stub page reaches the far
 * end of the ramp after two hundred pixels of scrolling, which hands the
 * strongest treatment to the documents that have the least to say. Measuring
 * it in screens rather than pixels keeps that judgement the same on a phone as
 * on a desktop: the depth is bought with reading, and a screen is a screenful
 * of reading whatever it is being read on.
 */
const REFERENCE_SCREENS = 3.5

/**
 * How far a page has been scrolled, as a fraction between zero and one.
 *
 * A page with nothing to scroll reports zero rather than one. That is the
 * honest answer: a document short enough to fit on the screen has no descent
 * to be part of the way down, and reporting it as finished would give the
 * shortest pages the deepest atmosphere, which is backwards. A page with only
 * a little to scroll reports only a little, for the same reason, by way of
 * {@link REFERENCE_SCREENS}.
 *
 * @param view - The window to measure.
 * @returns A fraction in `[0, 1]`.
 * @example Reading how far down a stub page a reader is
 * ```ts
 * // A 1,300px page in a 900px window, scrolled to its end
 * readScrollProgress(window) // 0.12, not 1
 * ```
 */
export function readScrollProgress(view: Window): number {
  const scrollable = view.document.documentElement.scrollHeight - view.innerHeight
  if (scrollable <= 0 || view.innerHeight <= 0) {
    return 0
  }
  const fraction = view.scrollY / scrollable
  const travelled = view.scrollY / (REFERENCE_SCREENS * view.innerHeight)
  return min(1, max(0, min(fraction, travelled)))
}

/**
 * Publish how far down the page the reader is as a custom property.
 *
 * One number on the document element, which every layer that wants to respond
 * to the descent can read without any of them listening to anything. Work
 * happens only while the page is actually moving: the listener coalesces into
 * one animation frame, and a frame that finds the rounded fraction unchanged
 * writes nothing, so a page held still costs nothing at all.
 *
 * @param view - The window to observe.
 * @returns A function that stops observing and clears the property.
 * @example Publishing the fraction for the page's own lifetime
 * ```ts
 * useEffect(() => trackScrollProgress(window), [])
 * ```
 */
export function trackScrollProgress(view: Window): () => void {
  const root = view.document.documentElement
  let frame = 0
  let published = -1

  const publish = (): void => {
    frame = 0
    const value = round(readScrollProgress(view) / STEP) * STEP
    if (value === published) {
      return
    }
    published = value
    root.style.setProperty(PROGRESS_PROPERTY, value.toFixed(2))
  }

  const schedule = (): void => {
    if (frame === 0) {
      frame = view.requestAnimationFrame(publish)
    }
  }

  publish()
  view.addEventListener('scroll', schedule, { passive: true })
  view.addEventListener('resize', schedule, { passive: true })

  // why: a page grows after it is first painted, as diagrams draw and the reference expands, and the fraction is measured against a height that has just changed
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
  observer?.observe(view.document.body)

  return () => {
    view.removeEventListener('scroll', schedule)
    view.removeEventListener('resize', schedule)
    observer?.disconnect()
    if (frame !== 0) {
      view.cancelAnimationFrame(frame)
    }
    root.style.removeProperty(PROGRESS_PROPERTY)
  }
}
