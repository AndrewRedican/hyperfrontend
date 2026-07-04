describe('@hyperfrontend/project-scope CJS', () => {
  it('should be importable via require', () => {
    const projectScope = require('@hyperfrontend/project-scope')
    expect(projectScope).toBeDefined()
  })

  it('should export createTree function', () => {
    const { createTree } = require('@hyperfrontend/project-scope')
    expect(typeof createTree).toBe('function')
  })

  it('should export createTreeFromDisk function', () => {
    const { createTreeFromDisk } = require('@hyperfrontend/project-scope')
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('should export analyzeProject function', () => {
    const { analyzeProject } = require('@hyperfrontend/project-scope')
    expect(typeof analyzeProject).toBe('function')
  })
})

describe('NX heuristics (CJS)', () => {
  it('should export isNxWorkspace function', () => {
    const { isNxWorkspace } = require('@hyperfrontend/project-scope')
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('should export findNxWorkspaceRoot function', () => {
    const { findNxWorkspaceRoot } = require('@hyperfrontend/project-scope')
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('should export isNxProject function', () => {
    const { isNxProject } = require('@hyperfrontend/project-scope')
    expect(typeof isNxProject).toBe('function')
  })

  it('should export getNxWorkspaceInfo function', () => {
    const { getNxWorkspaceInfo } = require('@hyperfrontend/project-scope')
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('should export discoverNxProjects function', () => {
    const { discoverNxProjects } = require('@hyperfrontend/project-scope')
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('should export buildSimpleProjectGraph function', () => {
    const { buildSimpleProjectGraph } = require('@hyperfrontend/project-scope')
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('should export nxDetector function', () => {
    const { nxDetector } = require('@hyperfrontend/project-scope')
    expect(typeof nxDetector).toBe('function')
  })
})
