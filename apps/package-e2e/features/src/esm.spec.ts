/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/features
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/features ESM', () => {
  it('should be importable', async () => {
    const pkg = await import('@hyperfrontend/features')
    expect(pkg).toBeDefined()
  })

  it('should have exports', async () => {
    const pkg = await import('@hyperfrontend/features')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('should export functions or objects', async () => {
    const pkg = await import('@hyperfrontend/features')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})
