/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/questions`
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/questions ESM', () => {
  it('is importable', async () => {
    const pkg = await import('@hyperfrontend/questions')
    expect(pkg).toBeDefined()
  })

  it('has exports', async () => {
    const pkg = await import('@hyperfrontend/questions')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('exports functions or objects', async () => {
    const pkg = await import('@hyperfrontend/questions')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})
