import type { FileTree } from '@hyperfrontend/testing/fs'
import type { ProjectRecord } from '../graph/model'
import type { ExecutorSchema } from './executors'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverProjects, listFiles } from '../graph/workspace'
import { createRunnerWorkspace } from './__test-utils__/workspace'
import { loadExecutor, locateExecutor, settle, withDefaults } from './executors'

const workspace = createRunnerWorkspace()
afterAll(() => workspace.remove())
const projects = discoverProjects(workspace.path, listFiles(workspace.path))

/**
 * The projects of the fixture workspace with some of its files replaced.
 *
 * @param tree - The files that differ
 * @returns The root and the projects, for the caller to remove the root
 */
function variant(tree: FileTree): { root: string; projects: Map<string, ProjectRecord>; remove: () => void } {
  const directory = createRunnerWorkspace(tree)
  return { root: directory.path, projects: discoverProjects(directory.path, listFiles(directory.path)), remove: directory.remove }
}

describe('locateExecutor', () => {
  it('finds the TypeScript module the manifest names, with its schema', () => {
    expect(locateExecutor(workspace.path, projects, '@fixture/tooling:build')).toEqual({
      file: join(workspace.path, 'tools/tooling/src/build/executor.ts'),
      schema: { properties: { mode: { type: 'string', default: 'schema' }, verbose: { type: 'boolean', default: false } } },
    })
  })

  it.each(['bare', ':build'])('refuses the executor %j, written without a package', (executor) => {
    expect(() => locateExecutor(workspace.path, projects, executor)).toThrow(`the executor ${executor} is not written as <package>:<name>`)
  })

  it('refuses the executors of the nx package but run-commands', () => {
    expect(() => locateExecutor(workspace.path, projects, 'nx:run-script')).toThrow(
      "the executor nx:run-script is not supported; of the nx package's executors only nx:run-commands runs"
    )
  })

  it.each(['@fixture/installed', '@fixture/other'])('refuses an executor of %j, which no workspace project provides', (packageName) => {
    expect(() => locateExecutor(workspace.path, projects, `${packageName}:build`)).toThrow(
      `no workspace project provides the executors of ${packageName}; only the workspace's own executors run`
    )
  })

  it('refuses an executor the manifest does not list', () => {
    expect(() => locateExecutor(workspace.path, projects, '@fixture/tooling:nope')).toThrow(
      `@fixture/tooling lists no executor nope in ${join(workspace.path, 'tools/tooling/executors.json')}`
    )
  })

  it.each([
    ['does not parse', 'not json'],
    ['lists no executors', {}],
  ])('refuses every executor of a manifest that %s', (_, manifest) => {
    const changed = variant({ 'tools/tooling/executors.json': manifest })
    try {
      expect(() => locateExecutor(changed.root, changed.projects, '@fixture/tooling:build')).toThrow(
        '@fixture/tooling lists no executor build'
      )
    } finally {
      changed.remove()
    }
  })

  it('refuses an executor whose module is missing', () => {
    expect(() => locateExecutor(workspace.path, projects, '@fixture/tooling:missing')).toThrow(
      'the module implementing @fixture/tooling:missing is missing: ./src/missing.ts'
    )
  })

  it('refuses an executor whose schema is missing', () => {
    expect(() => locateExecutor(workspace.path, projects, '@fixture/tooling:no-schema')).toThrow(
      'the options schema of @fixture/tooling:no-schema is missing or does not parse: ./src/none.json'
    )
  })
})

describe('withDefaults', () => {
  it('fills an option left unset and keeps one given', () => {
    const schema: ExecutorSchema = { properties: { tag: { default: 'latest' }, access: { default: 'public' } } }
    expect(withDefaults({ access: 'restricted' }, schema)).toEqual({ access: 'restricted', tag: 'latest' })
  })

  it('leaves the options it was given unchanged', () => {
    const options = { access: 'restricted' }
    withDefaults(options, { properties: { tag: { default: 'latest' } } })
    expect(options).toEqual({ access: 'restricted' })
  })

  it('leaves an option unset that has no default', () => {
    expect(withDefaults({}, { properties: { tag: { type: 'string' } } })).toEqual({})
  })

  it('fills nothing from a schema without properties', () => {
    expect(withDefaults({ a: 1 }, {})).toEqual({ a: 1 })
  })
})

describe('loadExecutor', () => {
  const source = { file: '/work/executor.ts', schema: {} }

  it('answers the default export', async () => {
    const executor = (): Promise<{ success: boolean }> => promiseResolve({ success: true })
    expect(await loadExecutor(source, () => promiseResolve({ default: executor }), 'a:b')).toBe(executor)
  })

  it('refuses a module whose default export is not a function', async () => {
    await expect(loadExecutor(source, () => promiseResolve({ default: 1 }), 'a:b')).rejects.toThrow(
      '/work/executor.ts has no default export implementing a:b'
    )
  })
})

describe('settle', () => {
  it.each([
    ['a promise of success', promiseResolve({ success: true }), true],
    ['a promise of failure', promiseResolve({ success: false }), false],
    ['a promise of nothing', promiseResolve(undefined), false],
    ['a promise of null', promiseResolve(null), false],
    ['a result answered without a promise', { success: true }, true],
  ])('reads %s', async (_, answer, success) => {
    expect(await settle(answer)).toBe(success)
  })
})
