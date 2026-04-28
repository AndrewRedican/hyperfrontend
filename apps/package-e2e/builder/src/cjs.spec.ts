/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/builder
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/builder CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('should have exports', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('should export functions or objects', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})
