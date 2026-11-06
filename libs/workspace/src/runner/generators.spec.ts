import type { FileTree } from '@hyperfrontend/testing/fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverProjects, listFiles } from '../graph/workspace'
import { createRunnerWorkspace } from './__test-utils__/workspace'
import { generatorNames, locateGenerator } from './generators'

/** A workspace whose tooling project and a second project offer generators, with the engine installed. */
const TREE: FileTree = {
  '.gitignore': 'node_modules\n',
  'tools/tooling/package.json': { name: '@fixture/tooling', private: true, executors: './executors.json', generators: './generators.json' },
  'tools/tooling/generators.json': {
    generators: {
      library: { factory: './src/library/generator', schema: './src/library/schema.json' },
      shared: { factory: './src/library/generator', schema: './src/library/schema.json' },
      gone: { factory: './src/gone/generator', schema: './src/library/schema.json' },
      'no-schema': { factory: './src/library/generator', schema: './src/none.json' },
    },
  },
  'tools/tooling/src/library/generator.ts': 'export default (): void => {}\n',
  'tools/tooling/src/library/schema.json': { properties: { name: { type: 'string' } } },
  'tools/other/package.json': { name: '@fixture/other', private: true, generators: './generators.json' },
  'tools/other/generators.json': { generators: { shared: { factory: './shared', schema: './shared.json' } } },
  'node_modules/@hyperfrontend/workspace/package.json': { name: '@hyperfrontend/workspace', generators: './generators.json' },
  'node_modules/@hyperfrontend/workspace/generators.json': {
    generators: {
      library: { factory: './generators/library/index', schema: './generators/library/schema.json' },
      workspace: { factory: './generators/workspace/index', schema: './generators/workspace/schema.json' },
    },
  },
  'node_modules/@hyperfrontend/workspace/generators/library/index.js': 'export default () => {}\n',
  'node_modules/@hyperfrontend/workspace/generators/library/schema.json': { properties: {} },
  'node_modules/@hyperfrontend/workspace/generators/workspace/index.js': 'export default () => {}\n',
  'node_modules/@hyperfrontend/workspace/generators/workspace/schema.json': { properties: { scope: { type: 'string' } } },
}

const workspace = createRunnerWorkspace(TREE)
afterAll(() => workspace.remove())
const projects = discoverProjects(workspace.path, listFiles(workspace.path))
const engine = join(workspace.path, 'node_modules/@hyperfrontend/workspace')

describe('locateGenerator', () => {
  it('gives a bare name to the workspace project that lists it, in front of the engine', () => {
    expect(locateGenerator(workspace.path, projects, 'library')).toEqual({
      file: join(workspace.path, 'tools/tooling/src/library/generator.ts'),
      schema: { properties: { name: { type: 'string' } } },
    })
  })

  it('gives a bare name no workspace project lists to the engine', () => {
    expect(locateGenerator(workspace.path, projects, 'workspace')).toEqual({
      file: join(engine, 'generators/workspace/index.js'),
      schema: { properties: { scope: { type: 'string' } } },
    })
  })

  it('reaches the generator of a named package past a workspace project of the same name', () => {
    expect(locateGenerator(workspace.path, projects, '@hyperfrontend/workspace:library').file).toBe(
      join(engine, 'generators/library/index.js')
    )
  })

  it('refuses a bare name two workspace projects list', () => {
    expect(() => locateGenerator(workspace.path, projects, 'shared')).toThrow(
      '@fixture/other:shared and @fixture/tooling:shared both answer to shared; name the package'
    )
  })

  it.each(['nope', '@fixture/tooling:nope', '@fixture/absent:library'])(
    'refuses %s, which nothing lists, naming what there is',
    (written) => {
      expect(() => locateGenerator(workspace.path, projects, written)).toThrow(
        `no generator ${written}: @fixture/other:shared, @fixture/tooling:library, @fixture/tooling:shared, @fixture/tooling:gone, @fixture/tooling:no-schema, @hyperfrontend/workspace:library, @hyperfrontend/workspace:workspace`
      )
    }
  )

  it('refuses a generator whose module is missing', () => {
    expect(() => locateGenerator(workspace.path, projects, 'gone')).toThrow(
      'the module implementing the generator gone is missing: ./src/gone/generator'
    )
  })

  it('refuses a generator whose schema is missing', () => {
    expect(() => locateGenerator(workspace.path, projects, 'no-schema')).toThrow(
      'the options schema of the generator no-schema is missing or does not parse: ./src/none.json'
    )
  })
})

describe('generatorNames', () => {
  it('lists the engine once where the workspace carries it as a project', () => {
    const carrying = createRunnerWorkspace({
      'engine/package.json': { name: '@hyperfrontend/workspace', generators: './generators.json' },
      'engine/generators.json': { generators: { workspace: { factory: './workspace', schema: './workspace.json' } } },
    })
    try {
      expect(generatorNames(carrying.path, discoverProjects(carrying.path, listFiles(carrying.path)))).toEqual([
        '@hyperfrontend/workspace:workspace',
      ])
    } finally {
      carrying.remove()
    }
  })

  it('lists nothing where no project offers generators and the engine is not installed', () => {
    const bare = createRunnerWorkspace()
    try {
      expect(generatorNames(bare.path, discoverProjects(bare.path, listFiles(bare.path)))).toEqual([])
    } finally {
      bare.remove()
    }
  })

  it('reads a manifest that lists no generators as an empty one', () => {
    const empty = createRunnerWorkspace({
      'tools/tooling/package.json': { name: '@fixture/tooling', private: true, generators: './generators.json' },
      'tools/tooling/generators.json': {},
    })
    try {
      expect(generatorNames(empty.path, discoverProjects(empty.path, listFiles(empty.path)))).toEqual([])
    } finally {
      empty.remove()
    }
  })
})
