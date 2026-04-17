/**
 * UMD bundle E2E tests for @hyperfrontend/questions
 * Tests that the UMD bundle loads correctly in browser context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/questions UMD bundle', () => {
  const bundlePath = getBundlePath('questions', 'umd')
  const minBundlePath = getBundlePath('questions', 'umd', true)

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
