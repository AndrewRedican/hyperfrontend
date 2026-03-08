describe('@hyperfrontend/project-scope CJS', () => {
  it('should be importable via require', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const projectScope = require('@hyperfrontend/project-scope')
    expect(projectScope).toBeDefined()
  })

  it('should export createTree function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTree } = require('@hyperfrontend/project-scope')
    expect(typeof createTree).toBe('function')
  })

  it('should export createTreeFromDisk function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTreeFromDisk } = require('@hyperfrontend/project-scope')
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('should export analyzeProject function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { analyzeProject } = require('@hyperfrontend/project-scope')
    expect(typeof analyzeProject).toBe('function')
  })
})
