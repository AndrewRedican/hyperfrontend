/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/questions
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/questions CJS', () => {
  it('should be requireable', () => {
    const pkg = require('@hyperfrontend/questions')
    expect(pkg).toBeDefined()
  })

  it('should have exports', () => {
    const pkg = require('@hyperfrontend/questions')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('should export functions or objects', () => {
    const pkg = require('@hyperfrontend/questions')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})
