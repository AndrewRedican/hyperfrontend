import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { workspacePackages } from './workspace-packages'

describe('workspacePackages', () => {
  const workspace = useTempDir({
    prefix: 'executors-packages-',
    tree: {
      'libs/a/package.json': '{ "name": "@fixture/a" }',
      'libs/unnamed/package.json': '{ "private": true }',
      'apps/site/project.json': '{ "name": "site" }',
    },
  })

  it('names the package of every project that carries one', () => {
    expect(
      workspacePackages(workspace.path, { a: { root: 'libs/a' }, unnamed: { root: 'libs/unnamed' }, site: { root: 'apps/site' } })
    ).toEqual(['@fixture/a'])
  })
})
