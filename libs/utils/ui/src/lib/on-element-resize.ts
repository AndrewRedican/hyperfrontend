export type ElementResizeCallback = (rect: DOMRectReadOnly) => void

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
