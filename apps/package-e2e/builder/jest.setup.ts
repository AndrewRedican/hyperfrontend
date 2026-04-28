/**
 * Jest setup for browser bundle tests.
 * Cleans up window globals between tests.
 */

// jsdom doesn't provide TextEncoder/TextDecoder by default
import { TextEncoder, TextDecoder } from 'util'

Object.assign(global, { TextEncoder, TextDecoder })

beforeEach(() => {
  // Clear any globals that may have been set by previous tests
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).HyperfrontendBuilder !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).HyperfrontendBuilder = undefined
    }
  } catch {
    // Property may not be deletable, that's ok
  }
})

afterEach(() => {
  // Remove any added script elements
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})
