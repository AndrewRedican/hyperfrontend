'use client'

import { useSyncExternalStore } from 'react'

/**
 * Subscribes to the document's visibility.
 * @param listener - Called when the tab is hidden or shown
 * @returns Unsubscribes
 */
function subscribe(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

/**
 * Whether the tab is visible, so a hidden tab makes no requests.
 * @returns True while the document is visible; true on the server
 */
export function useVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState !== 'hidden',
    () => true
  )
}
