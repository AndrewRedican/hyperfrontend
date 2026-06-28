import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createElement } from '@hyperfrontend/ui-utils/element'

// note: Borderless and transparent so the embedded feature blends into the host page.

/**
 * Resolves a container option to a concrete element.
 *
 * @param container - A CSS selector string or an element reference.
 * @returns The resolved host element.
 *
 * @example Resolving a selector
 * ```typescript
 * const host = resolveContainer('#clock-container')
 * ```
 */
export function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container !== 'string') {
    return container
  }
  const found = document.querySelector(container)
  if (found === null) {
    throw createError(`Shell container not found for selector "${container}".`)
  }
  return <HTMLElement>found
}

/**
 * Creates a borderless iframe pointing at the feature URL.
 *
 * @param url - The feature app URL to load.
 * @returns The configured iframe element (not yet attached to the DOM).
 *
 * @example Creating a feature iframe
 * ```typescript
 * const iframe = createFeatureIframe('https://clock.example.com')
 * container.appendChild(iframe)
 * ```
 */
export function createFeatureIframe(url: string): HTMLIFrameElement {
  const iframe = createElement<HTMLIFrameElement>('iframe', {
    inlineStyle: { border: 'none', width: '100%', height: '100%' },
  }).ref
  iframe.src = url
  iframe.setAttribute('allowtransparency', 'true')
  return iframe
}
