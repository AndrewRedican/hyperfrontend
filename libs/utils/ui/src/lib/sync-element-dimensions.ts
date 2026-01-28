import type { ElementRefOrString, GetElementAsyncOptions } from './get-element-async'
import { getElementAsync } from './get-element-async'
import { onElementResize } from './on-element-resize'

export function syncElementDimensions<S extends HTMLElement = HTMLElement, T extends HTMLElement = HTMLElement>(
  sourceElementRefOrString: ElementRefOrString<S>,
  targetElementRefOrString: ElementRefOrString<T>,
  options?: GetElementAsyncOptions
): () => void {
  let stopSyncing: (() => void) | undefined
  let unsubscribeResize: (() => void) | undefined

  function syncDimensions(sourceElement: HTMLElement, targetElement: HTMLElement): void {
    const rect = sourceElement.getBoundingClientRect()
    targetElement.style.width = `${rect.width}px`
    targetElement.style.height = `${rect.height}px`
    targetElement.style.top = `${rect.top}px`
    targetElement.style.left = `${rect.left}px`
    targetElement.style.position = sourceElement.style.position
  }

  function startSyncing(sourceElement: HTMLElement, targetElement: HTMLElement): void {
    syncDimensions(sourceElement, targetElement)
    unsubscribeResize = onElementResize(sourceElement, () => syncDimensions(sourceElement, targetElement))
  }

  function onSourceElementFound(sourceElement: HTMLElement): void {
    const cancelGetTarget = getElementAsync(targetElementRefOrString, {
      ...options,
      /* istanbul ignore next */
      onSuccess: (targetElement) => onTargetElementFound(sourceElement, targetElement),
      onFail: options?.onFail,
    })

    stopSyncing = () => {
      cancelGetTarget()
      if (unsubscribeResize) {
        unsubscribeResize()
      }
    }
  }

  function onTargetElementFound(sourceElement: HTMLElement, targetElement: HTMLElement): void {
    startSyncing(sourceElement, targetElement)
  }

  const cancelGetSource = getElementAsync(sourceElementRefOrString, {
    ...options,
    onSuccess: onSourceElementFound,
    onFail: options?.onFail,
  })

  return () => {
    if (stopSyncing) {
      stopSyncing()
    } else {
      cancelGetSource()
    }
  }
}
