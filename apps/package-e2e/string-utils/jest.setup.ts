/**
 * Jest setup for browser bundle tests.
 * Cleans up window globals between tests.
 */

import { TextEncoder, TextDecoder } from 'node:util'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
})

beforeEach(() => {
  // Clear any globals that may have been set by previous tests
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).HyperfrontendStringUtils !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).HyperfrontendStringUtils = undefined
    }
  } catch {
    // Property may not be deletable, that's ok
  }
})

afterEach(() => {
  // Remove any added script elements
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})
