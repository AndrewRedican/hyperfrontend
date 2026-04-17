/**
 * IIFE bundle E2E tests for @hyperfrontend/questions
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/questions IIFE bundle', () => {
  const bundlePath = getBundlePath('questions', 'iife')
  const minBundlePath = getBundlePath('questions', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendQuestions to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendQuestions')

    expect(global).toBeDefined()
  })

  it('should have exports on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendQuestions') as Record<string, unknown>

    const exportedKeys = Object.keys(global)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })
})
