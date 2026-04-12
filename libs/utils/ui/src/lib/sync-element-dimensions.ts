import type { ElementRefOrString, GetElementAsyncOptions } from './get-element-async'
import { getElementAsync } from './get-element-async'
import { onElementResize } from './on-element-resize'

/**
 * Synchronizes the dimensions and position of a target element with a source element.
 * Automatically updates when the source element is resized.
 *
 * @param sourceElementRefOrString - The source element to copy dimensions from (element or selector)
 * @param targetElementRefOrString - The target element to apply dimensions to (element or selector)
 * @param options - Optional configuration for element retrieval and callbacks
 * @returns A cleanup function to stop synchronization
 *
 * @example Syncing overlay to video dimensions
 * ```typescript
 * // Sync an overlay to match a video player's dimensions
 * const stopSync = syncElementDimensions('#video-player', '#overlay', {
 *   onSuccess: () => console.log('Elements synced'),
 * })
 *
 * // Stop syncing when component unmounts
 * stopSync()
 * ```
 */
export function syncElementDimensions<S extends HTMLElement = HTMLElement, T extends HTMLElement = HTMLElement>(
  sourceElementRefOrString: ElementRefOrString<S>,
  targetElementRefOrString: ElementRefOrString<T>,
  options?: GetElementAsyncOptions
): () => void {
  let stopSyncing: (() => void) | undefined
  let unsubscribeResize: (() => void) | undefined

  /**
   * Copies dimensions and position from source to target element.
   *
   * @param sourceElement - The source element to read dimensions from
   * @param targetElement - The target element to apply dimensions to
   */
  function syncDimensions(sourceElement: HTMLElement, targetElement: HTMLElement): void {
    const rect = sourceElement.getBoundingClientRect()
    targetElement.style.width = `${rect.width}px`
    targetElement.style.height = `${rect.height}px`
    targetElement.style.top = `${rect.top}px`
    targetElement.style.left = `${rect.left}px`
    targetElement.style.position = sourceElement.style.position
  }

  /**
   * Initializes dimension synchronization and sets up resize observer.
   *
   * @param sourceElement - The source element to observe
   * @param targetElement - The target element to update
   */
  function startSyncing(sourceElement: HTMLElement, targetElement: HTMLElement): void {
    syncDimensions(sourceElement, targetElement)
    unsubscribeResize = onElementResize(sourceElement, () => syncDimensions(sourceElement, targetElement))
  }

  /**
   * Called when the source element is found, initiates target element search.
   *
   * @param sourceElement - The HTML element whose dimensions will be used as the reference for synchronization
   */
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

  /**
   * Called when both elements are found, starts the synchronization.
   *
   * @param sourceElement - The HTML element whose dimensions will be read and copied
   * @param targetElement - The HTML element that will receive the synchronized dimensions
   */
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
