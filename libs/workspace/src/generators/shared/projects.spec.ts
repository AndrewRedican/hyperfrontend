import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getProjects, readProjectConfiguration } from './projects'

const tree = createMemoryTree({
  '.gitignore': 'node_modules\n',
  'libs/a/project.json': '{ "name": "lib-a", "tags": ["type:util"], "targets": { "build": {} } }',
  'tools/b/project.json': '{ "sourceRoot": "tools/b/src" }',
  'node_modules/pkg/project.json': '{ "name": "ignored" }',
})

describe('getProjects', () => {
  it('reads every project file git would keep, naming an unnamed one after its directory', () => {
    expect([...getProjects(tree).values()]).toEqual([
      { name: 'lib-a', root: 'libs/a', tags: ['type:util'], targets: { build: {} } },
      { name: 'b', root: 'tools/b', sourceRoot: 'tools/b/src' },
    ])
  })
})

describe('readProjectConfiguration', () => {
  it('returns the named project', () => {
    expect(readProjectConfiguration(tree, 'lib-a').root).toBe('libs/a')
  })

  it('names a project that is not there', () => {
    expect(() => readProjectConfiguration(tree, 'lib-z')).toThrow("Cannot find configuration for 'lib-z'")
  })
})
