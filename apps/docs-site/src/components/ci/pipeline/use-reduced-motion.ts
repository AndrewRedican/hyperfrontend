'use client'

import { useSyncExternalStore } from 'react'

/** The query a reader's request for less motion answers to. */
const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Subscribes to the reader's motion preference.
 * @param listener - Called when it changes
 * @returns Unsubscribes
 */
function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

/**
 * Whether the reader asked for less motion, so a drawing that would creep along holds still between reads.
 * @returns True when they did; false on the server
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
