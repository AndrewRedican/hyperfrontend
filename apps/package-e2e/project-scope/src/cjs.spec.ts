'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

describe('@hyperfrontend/project-scope CJS', () => {
  it('is importable via require', () => {
    const projectScope = require('@hyperfrontend/project-scope')
    expect(projectScope).toBeDefined()
  })

  it('exports createTree function', () => {
    const { createTree } = require('@hyperfrontend/project-scope')
    expect(typeof createTree).toBe('function')
  })

  it('exports createTreeFromDisk function', () => {
    const { createTreeFromDisk } = require('@hyperfrontend/project-scope')
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('exports analyzeProject function', () => {
    const { analyzeProject } = require('@hyperfrontend/project-scope')
    expect(typeof analyzeProject).toBe('function')
  })
})

describe('NX heuristics (CJS)', () => {
  it('exports isNxWorkspace function', () => {
    const { isNxWorkspace } = require('@hyperfrontend/project-scope')
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('exports findNxWorkspaceRoot function', () => {
    const { findNxWorkspaceRoot } = require('@hyperfrontend/project-scope')
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('exports isNxProject function', () => {
    const { isNxProject } = require('@hyperfrontend/project-scope')
    expect(typeof isNxProject).toBe('function')
  })

  it('exports getNxWorkspaceInfo function', () => {
    const { getNxWorkspaceInfo } = require('@hyperfrontend/project-scope')
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('exports discoverNxProjects function', () => {
    const { discoverNxProjects } = require('@hyperfrontend/project-scope')
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('exports buildSimpleProjectGraph function', () => {
    const { buildSimpleProjectGraph } = require('@hyperfrontend/project-scope')
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('exports nxDetector function', () => {
    const { nxDetector } = require('@hyperfrontend/project-scope')
    expect(typeof nxDetector).toBe('function')
  })
})
