import {
  analyzeProject,
  buildSimpleProjectGraph,
  createTree,
  createTreeFromDisk,
  discoverNxProjects,
  findNxWorkspaceRoot,
  getNxWorkspaceInfo,
  isNxProject,
  isNxWorkspace,
  nxDetector,
} from '@hyperfrontend/project-scope'

describe('@hyperfrontend/project-scope ESM', () => {
  it('should export createTree function', () => {
    expect(typeof createTree).toBe('function')
  })

  it('should export createTreeFromDisk function', () => {
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('should export analyzeProject function', () => {
    expect(typeof analyzeProject).toBe('function')
  })
})

describe('NX heuristics (ESM)', () => {
  it('should export isNxWorkspace function', () => {
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('should export findNxWorkspaceRoot function', () => {
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('should export isNxProject function', () => {
    expect(typeof isNxProject).toBe('function')
  })

  it('should export getNxWorkspaceInfo function', () => {
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('should export discoverNxProjects function', () => {
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('should export buildSimpleProjectGraph function', () => {
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('should export nxDetector function', () => {
    expect(typeof nxDetector).toBe('function')
  })
})
