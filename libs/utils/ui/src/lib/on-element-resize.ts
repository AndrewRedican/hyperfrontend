/** Callback invoked when an element is resized with the new content rect. */
export type ElementResizeCallback = (rect: DOMRectReadOnly) => void

/**
 * Observes an element for size changes and triggers a callback when resized.
 *
 * @param element - The element to observe for resize events
 * @param callback - The function to call when the element is resized
 * @returns A cleanup function to stop observing the element
 *
 * @example
 * ```typescript
 * const container = document.getElementById('resizable-panel')
 * const stopObserving = onElementResize(container, (rect) => {
 *   console.log(`New size: ${rect.width}x${rect.height}`)
 * })
 *
 * // Stop observing when done
 * stopObserving()
 * ```
 */
export function onElementResize(element: HTMLElement, callback: ElementResizeCallback): () => void {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (!isDisconnected) {
        callback(entry.contentRect)
      }
    }
  })

  let isDisconnected = false
  resizeObserver.observe(element)

  return () => {
    isDisconnected = true
    resizeObserver.unobserve(element)
  }
}
