'use client'

import { useEffect, useCallback } from 'react'
import { requestAnimationFrame, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Options for the useHashNavigation hook.
 */
interface UseHashNavigationOptions {
  /**
   * Whether hash navigation is enabled.
   * When false, the hook does nothing.
   *
   * @default true
   */
  enabled?: boolean
  /**
   * Duration in milliseconds for the highlight ring effect.
   *
   * @default 2000
   */
  highlightDuration?: number
  /**
   * CSS class to add for the highlight effect.
   *
   * @default 'ring-2 ring-primary-500 ring-offset-2'
   */
  highlightClass?: string
}

/**
 * Scrolls to an element matching the URL hash with a visual highlight effect.
 * Handles initial page load and hash change events.
 *
 * @param options - Configuration options
 * @returns scrollToHash function that can be called manually
 *
 * @example
 * ```tsx
 * // Basic usage - auto-scrolls on load and hash changes
 * function MyComponent() {
 *   useHashNavigation()
 *   return <div id="some-section">...</div>
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally enable based on view mode
 * function ApiReference() {
 *   const { scrollToHash } = useHashNavigation({ enabled: viewMode === 'flat' })
 *   return <div>...</div>
 * }
 * ```
 */
export function useHashNavigation(options: UseHashNavigationOptions = {}) {
  const { enabled = true, highlightDuration = 2000, highlightClass = 'ring-2 ring-primary-500 ring-offset-2' } = options

  const highlightClasses = highlightClass.split(' ').filter(Boolean)

  const scrollToHash = useCallback(() => {
    const hash = window.location.hash
    if (hash) {
      requestAnimationFrame(() => {
        const element = document.querySelector(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          element.classList.add(...highlightClasses)
          setTimeout(() => {
            element.classList.remove(...highlightClasses)
          }, highlightDuration)
        }
      })
    }
  }, [highlightClasses, highlightDuration])

  useEffect(() => {
    if (!enabled) return

    scrollToHash()

    const handleHashChange = () => scrollToHash()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [enabled, scrollToHash])

  return { scrollToHash }
}
