import { stubGlobal } from '../mock/replace'

/**
 * A size to report for an observed element, in CSS pixels.
 */
export type ObservedSize = {
  /** Content-box width. */
  width: number
  /** Content-box height. */
  height: number
}

/**
 * Drives the `ResizeObserver` that `installResizeObserver` put on the global.
 */
export type ResizeObserverController = {
  /** Reports a new size for an element to every observer watching it, as one entry each. */
  resize(target: Element, size: ObservedSize): void
  /** Reports whether any live observer is watching an element. */
  isObserved(target: Element): boolean
  /** How many observers have been created and not disconnected. */
  observerCount(): number
  /** Puts back whatever `ResizeObserver` the global had before. `jest.restoreAllMocks` does the same. */
  restore(): void
}

/**
 * One live observer: its callback and the elements it watches.
 */
type ObserverRecord = {
  /** The callback the observer was constructed with. */
  callback: ResizeObserverCallback
  /** The observer itself, handed back to the callback. */
  observer: ResizeObserver
  /** The elements being watched. */
  targets: Set<Element>
}

/**
 * Builds the entry a browser reports for an element's new size.
 *
 * @param target - The element.
 * @param size - Its content-box size.
 * @returns The entry, with the rectangle and every box size filled in.
 */
function entryFor(target: Element, size: ObservedSize): ResizeObserverEntry {
  const { width, height } = size
  const box = [{ inlineSize: width, blockSize: height }]
  const contentRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({ x: 0, y: 0, width, height }),
  }
  return { target, contentRect, contentBoxSize: box, borderBoxSize: box, devicePixelContentBoxSize: box } as unknown as ResizeObserverEntry
}

/**
 * Puts a `ResizeObserver` on the global whose notifications the test sends, and returns the
 * controller that sends them.
 *
 * jsdom has no layout engine and so no `ResizeObserver`. Observers created through this one
 * behave like the real constructor's, observing, unobserving and disconnecting, but a
 * callback runs only when the test calls `resize`, never on its own: not even the initial
 * notification a browser sends after `observe`. The stub is installed like a stubbed global,
 * so `jest.restoreAllMocks` and the runner's `restoreMocks` option remove it.
 *
 * @returns The controller.
 * @example Driving a component that follows its container's width
 * ```ts
 * const observers = installResizeObserver()
 * const panel = mountPanel(container)
 * observers.resize(container, { width: 320, height: 200 })
 * expect(panel.layout()).toBe('compact')
 * ```
 */
export function installResizeObserver(): ResizeObserverController {
  const records = new Set<ObserverRecord>()

  class StubResizeObserver {
    /** What this observer watches and calls. */
    private readonly record: ObserverRecord

    /**
     * Creates an observer that the controller drives.
     *
     * @param callback - Called with the entries for each `resize` of a watched element.
     */
    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, observer: this as unknown as ResizeObserver, targets: new Set() }
      records.add(this.record)
    }

    /**
     * Starts watching an element.
     *
     * @param target - The element to watch.
     */
    observe(target: Element): void {
      this.record.targets.add(target)
    }

    /**
     * Stops watching one element.
     *
     * @param target - The element to stop watching.
     */
    unobserve(target: Element): void {
      this.record.targets.delete(target)
    }

    /**
     * Stops watching everything and retires the observer.
     */
    disconnect(): void {
      this.record.targets.clear()
      records.delete(this.record)
    }
  }

  const installed = stubGlobal('ResizeObserver', StubResizeObserver)

  return {
    resize: (target, size) => {
      for (const record of [...records]) if (record.targets.has(target)) record.callback([entryFor(target, size)], record.observer)
    },
    isObserved: (target) => [...records].some((record) => record.targets.has(target)),
    observerCount: () => records.size,
    restore: installed.restore,
  }
}
