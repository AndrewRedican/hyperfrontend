import { createTree, createTreeFromDisk, analyzeProject } from '@hyperfrontend/project-scope'

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
