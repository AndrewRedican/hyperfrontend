import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverProjects, listFiles } from '../graph/workspace'
import { createRunnerWorkspace } from './__test-utils__/workspace'
import { contributionManifest, moduleFile, packagedFile } from './packages'

const workspace = createRunnerWorkspace({
  '.gitignore': 'node_modules\n',
  'tools/tooling/package.json': { name: '@fixture/tooling', private: true, executors: './executors.json', generators: './generators.json' },
  'node_modules/@fixture/installed/package.json': { name: '@fixture/installed', executors: './executors.json' },
  'node_modules/@fixture/installed/dist/build.js': 'export default () => ({ success: true })\n',
  'node_modules/@fixture/installed/dist/both.ts': 'export default 1\n',
  'node_modules/@fixture/installed/dist/both.js': 'export default 1\n',
  'node_modules/@fixture/installed/dist/folder/index.js': 'export default 1\n',
  'node_modules/@fixture/installed/src/source/only.ts': 'export default 1\n',
  'node_modules/@fixture/installed/src/source/schema.json': '{}',
  'node_modules/@fixture/installed/src/dist/build.js': 'export default 2\n',
  'node_modules/@fixture/tooling/package.json': { name: '@fixture/tooling', executors: './installed.json' },
  'node_modules/plain/package.json': { name: 'plain' },
})
afterAll(() => workspace.remove())
const projects = discoverProjects(workspace.path, listFiles(workspace.path))
const installed = join(workspace.path, 'node_modules/@fixture/installed')

describe('contributionManifest', () => {
  it('prefers the workspace project that carries the package over an installed copy', () => {
    expect(contributionManifest(workspace.path, projects, '@fixture/tooling', 'executors')).toBe(
      join(workspace.path, 'tools/tooling/executors.json')
    )
  })

  it('answers the manifest of generators a workspace project declares', () => {
    expect(contributionManifest(workspace.path, projects, '@fixture/tooling', 'generators')).toBe(
      join(workspace.path, 'tools/tooling/generators.json')
    )
  })

  it('finds an installed package the workspace has no project for', () => {
    expect(contributionManifest(workspace.path, projects, '@fixture/installed', 'executors')).toBe(join(installed, 'executors.json'))
  })

  it.each([
    ['a workspace project that declares none', '@fixture/other'],
    ['an installed package that declares none', 'plain'],
    ['a package that is neither a project nor installed', '@fixture/absent'],
  ])('answers nothing for %s', (_, packageName) => {
    expect(contributionManifest(workspace.path, projects, packageName, 'executors')).toBe(undefined)
  })

  it('answers nothing for the contribution an installed package does not declare', () => {
    expect(contributionManifest(workspace.path, projects, '@fixture/installed', 'generators')).toBe(undefined)
  })
})

describe('moduleFile', () => {
  it('takes a path that names a file as written', () => {
    expect(moduleFile(installed, './dist/build.js')).toBe(join(installed, 'dist/build.js'))
  })

  it('adds the JavaScript extension a built package leaves out', () => {
    expect(moduleFile(installed, './dist/build')).toBe(join(installed, 'dist/build.js'))
  })

  it('prefers the TypeScript source where both exist', () => {
    expect(moduleFile(installed, './dist/both')).toBe(join(installed, 'dist/both.ts'))
  })

  it.each(['./dist/folder', './dist/absent'])('answers nothing for %s, which no file answers to', (written) => {
    expect(moduleFile(installed, written)).toBe(undefined)
  })
})

describe('a path the manifest names under the source directory', () => {
  it('finds a module that exists under src alone', () => {
    expect(moduleFile(installed, './source/only')).toBe(join(installed, 'src/source/only.ts'))
  })

  it('prefers the module beside the manifest over one under src', () => {
    expect(moduleFile(installed, './dist/build')).toBe(join(installed, 'dist/build.js'))
  })

  it('finds a schema that exists under src alone', () => {
    expect(packagedFile(installed, './source/schema.json')).toBe(join(installed, 'src/source/schema.json'))
  })

  it('answers nothing for a schema neither place holds', () => {
    expect(packagedFile(installed, './source/absent.json')).toBe(undefined)
  })
})
