import type { ResolvedSize, ViewportPayload } from '../shared/presentation'
import { parseFloat } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { onElementResize } from '@hyperfrontend/ui-utils/element'
import { resolveEmbedFallback } from '../shared/presentation'

/**
 * Reports the exact pixel dimensions of the space a feature frame occupies.
 *
 * Created by a display-mode mount seeded with a synchronous initial
 * measurement: `current()` feeds the presentation announcement, and once the
 * shell calls `start`, only **changes** relative to what was already announced
 * are forwarded — the initial size never crosses twice.
 */
export interface ViewportReporter {
  /** The most recent measurement, in exact pixels. */
  current(): ViewportPayload
  /** Begins forwarding size changes; anything already announced is not repeated. */
  start(report: (size: ViewportPayload) => void): void
  /** Stops observing and forwarding. */
  stop(): void
}

/**
 * Measures an element's content box synchronously, in exact CSS pixels.
 *
 * The content box is the space a `width/height: 100%` frame fills, so the
 * element's borders and padding are subtracted from its border-box rect;
 * margins sit outside the element and never affect the interior.
 *
 * @param element - The element to measure.
 * @returns The content-box width and height, floored at zero.
 *
 * @example Measuring a container before mounting into it
 * ```typescript
 * const { width, height } = measureContentBox(container)
 * ```
 */
export function measureContentBox(element: HTMLElement): ResolvedSize {
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const horizontal =
    (parseFloat(style.borderLeftWidth) || 0) +
    (parseFloat(style.borderRightWidth) || 0) +
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0)
  const vertical =
    (parseFloat(style.borderTopWidth) || 0) +
    (parseFloat(style.borderBottomWidth) || 0) +
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0)
  return { width: rect.width > horizontal ? rect.width - horizontal : 0, height: rect.height > vertical ? rect.height - vertical : 0 }
}

/**
 * Creates a reporter that observes an SDK-owned element and forwards its
 * content-box size on change.
 *
 * @param element - The element to observe (the dialog pane).
 * @param initial - The synchronously measured starting size.
 * @returns A reporter that forwards every content-box change of the element.
 *
 * @example Reporting the dialog pane's size
 * ```typescript
 * const reporter = createObserverReporter(iframe, { width: window.innerWidth, height: window.innerHeight })
 * ```
 */
export function createObserverReporter(element: HTMLElement, initial: ViewportPayload): ViewportReporter {
  let latest = initial
  let announced = initial
  let forward: ((size: ViewportPayload) => void) | null = null
  const deliver = (size: ViewportPayload) => {
    if (forward && (size.width !== announced.width || size.height !== announced.height)) {
      announced = size
      forward(size)
    }
  }
  const stopObserving = onElementResize(element, (rect) => {
    latest = { width: rect.width, height: rect.height }
    deliver(latest)
  })
  return {
    current() {
      return latest
    },
    start(report) {
      forward = report
      deliver(latest)
    },
    stop() {
      forward = null
      stopObserving()
    },
  }
}

/**
 * Creates the embedded-mode reporter: observes the host-provided container and
 * keeps the feature informed of the exact pixel space its frame occupies.
 *
 * The container is an anchor the surrounding host UI owns, so the reporter
 * works from its **content box** — the box the frame actually fills.
 * Percentage or relative container sizing, layout shifts from surrounding
 * content, and dynamic resizes all surface through the same observation,
 * already resolved to pixels.
 *
 * While the container measures zero on an axis (hidden, not yet laid out, or
 * height-collapsed because nothing sizes it), the reporter applies a
 * viewport-derived fallback to the frame on that axis — giving an auto-height
 * container a workable size — and reports those dimensions. Each axis retires
 * independently as soon as a measurement diverges from its applied fallback
 * (the surrounding layout took over), returning the frame to filling the
 * container on that axis.
 *
 * @param container - The host-provided container element wrapping the frame.
 * @param frame - The frame element the fallback is applied to.
 * @param measured - The container's content box, measured before the frame was inserted.
 * @returns A reporter that tracks the container, applying and retiring fallbacks per axis.
 *
 * @example Observing an embedded container
 * ```typescript
 * const reporter = createContainerReporter(container, iframe, measureContentBox(container))
 * reporter.start((size) => channel.send(ControlType.Viewport, size))
 * ```
 */
export function createContainerReporter(container: HTMLElement, frame: HTMLElement, measured: ResolvedSize): ViewportReporter {
  let forward: ((size: ViewportPayload) => void) | null = null
  let fallbackWidth: number | null = null
  let fallbackHeight: number | null = null

  const applyFallback = (width: number, height: number): ViewportPayload => {
    const size = resolveEmbedFallback(width, window.innerWidth, window.innerHeight)
    if (height === 0) {
      fallbackHeight = size.height
      frame.style.height = `${size.height}px`
    }
    if (width === 0) {
      fallbackWidth = size.width
      frame.style.width = `${size.width}px`
    }
    return { width: width || size.width, height: height || size.height }
  }

  const measure = (width: number, height: number): ViewportPayload => {
    if (width === 0 || height === 0) {
      return applyFallback(width, height)
    }
    // why: Each axis retires independently — a measurement that only echoes an applied fallback means the container is still adopting the frame's size on that axis, while any other value means the surrounding layout took over, so the frame goes back to filling it there. Coupling the axes would let a real width change tear down a still-needed height fallback and collapse the embed.
    if (fallbackWidth !== null && width !== fallbackWidth) {
      fallbackWidth = null
      frame.style.width = '100%'
    }
    if (fallbackHeight !== null && height !== fallbackHeight) {
      fallbackHeight = null
      frame.style.height = '100%'
    }
    return { width, height }
  }

  // why: Seeded from the pre-insertion measurement so the presentation announcement carries real dimensions (or an applied fallback) without waiting for the observer's first asynchronous fire.
  let latest = measure(measured.width, measured.height)
  let announced = latest

  const deliver = (size: ViewportPayload) => {
    if (forward && (size.width !== announced.width || size.height !== announced.height)) {
      announced = size
      forward(size)
    }
  }

  const stopObserving = onElementResize(container, (rect) => {
    latest = measure(rect.width, rect.height)
    deliver(latest)
  })

  return {
    current() {
      return latest
    },
    start(report) {
      forward = report
      deliver(latest)
    },
    stop() {
      forward = null
      stopObserving()
    },
  }
}
