import { defineProperty } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

// note: jsdom ships no ResizeObserver; specs install this stub and drive measurements through the returned controller instead of duplicating per-file stubs.

/**
 * A width/height pair fed into observation callbacks as the content rect.
 */
export interface StubContentRect {
  /** Content-box width in pixels. */
  width: number
  /** Content-box height in pixels. */
  height: number
}

/**
 * Drives the installed ResizeObserver stub from a spec.
 */
export interface ResizeObserverStubController {
  /** Invokes every callback observing the target with the given content rect. */
  resize(target: Element, size: StubContentRect): void
  /** Reports whether any live observer currently observes the target. */
  isObserved(target: Element): boolean
}

/**
 * A single stub observer's callback and its observed targets.
 */
interface ObserverRecord {
  /** The constructor-captured callback. */
  callback: (entries: unknown[], observer: unknown) => void
  /** Targets currently observed. */
  targets: Set<Element>
}

/**
 * Installs a `ResizeObserver` stub on `globalThis` and returns its controller.
 *
 * Call from `beforeEach`; installing again simply replaces the previous stub.
 *
 * @returns The controller that feeds measurements into observation callbacks.
 *
 * @example Driving a container measurement
 * ```typescript
 * const observers = installResizeObserverStub()
 * observers.resize(container, { width: 640, height: 480 })
 * ```
 */
export function installResizeObserverStub(): ResizeObserverStubController {
  const records = createSet<ObserverRecord>()

  class ResizeObserverStub {
    private readonly record: ObserverRecord

    constructor(callback: (entries: unknown[], observer: unknown) => void) {
      this.record = { callback, targets: createSet<Element>() }
      records.add(this.record)
    }

    observe(target: Element): void {
      this.record.targets.add(target)
    }

    unobserve(target: Element): void {
      this.record.targets.delete(target)
    }

    disconnect(): void {
      this.record.targets.clear()
      records.delete(this.record)
    }
  }

  defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true, writable: true })

  return {
    resize(target, size) {
      for (const record of records) {
        if (record.targets.has(target)) {
          record.callback([{ target, contentRect: { width: size.width, height: size.height } }], undefined)
        }
      }
    },
    isObserved(target) {
      for (const record of records) {
        if (record.targets.has(target)) {
          return true
        }
      }
      return false
    },
  }
}
