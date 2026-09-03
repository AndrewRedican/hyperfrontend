import { describe, it, expect } from '@hyperfrontend/testing'

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
  it('exports createTree function', () => {
    expect(typeof createTree).toBe('function')
  })

  it('exports createTreeFromDisk function', () => {
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('exports analyzeProject function', () => {
    expect(typeof analyzeProject).toBe('function')
  })
})

describe('NX heuristics (ESM)', () => {
  it('exports isNxWorkspace function', () => {
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('exports findNxWorkspaceRoot function', () => {
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('exports isNxProject function', () => {
    expect(typeof isNxProject).toBe('function')
  })

  it('exports getNxWorkspaceInfo function', () => {
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('exports discoverNxProjects function', () => {
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('exports buildSimpleProjectGraph function', () => {
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('exports nxDetector function', () => {
    expect(typeof nxDetector).toBe('function')
  })
})
