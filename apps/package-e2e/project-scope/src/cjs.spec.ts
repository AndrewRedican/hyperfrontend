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

describe('NX heuristics (CJS)', () => {
  it('should export isNxWorkspace function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isNxWorkspace } = require('@hyperfrontend/project-scope')
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('should export findNxWorkspaceRoot function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { findNxWorkspaceRoot } = require('@hyperfrontend/project-scope')
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('should export isNxProject function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isNxProject } = require('@hyperfrontend/project-scope')
    expect(typeof isNxProject).toBe('function')
  })

  it('should export getNxWorkspaceInfo function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNxWorkspaceInfo } = require('@hyperfrontend/project-scope')
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('should export discoverNxProjects function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { discoverNxProjects } = require('@hyperfrontend/project-scope')
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('should export buildSimpleProjectGraph function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildSimpleProjectGraph } = require('@hyperfrontend/project-scope')
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('should export nxDetector function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nxDetector } = require('@hyperfrontend/project-scope')
    expect(typeof nxDetector).toBe('function')
  })
})
