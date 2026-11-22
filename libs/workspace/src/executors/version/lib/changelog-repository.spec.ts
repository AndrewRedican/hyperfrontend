import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { changelogRepository } from './changelog-repository'

const workspaces = useTempDir({
  prefix: 'changelog-repository-',
  tree: {
    [join('object', 'package.json')]: { name: 'acme', repository: { type: 'git', url: 'git+https://github.com/acme/monorepo.git' } },
    [join('shorthand', 'package.json')]: { name: 'acme', repository: 'gitlab:acme/monorepo' },
    [join('silent', 'package.json')]: { name: 'acme' },
    [join('unreadable', 'package.json')]: { name: 'acme', repository: { type: 'git' } },
    [join('broken', 'package.json')]: '{ "repository": ',
    [join('bare', 'keep.txt')]: '',
  },
})

describe('changelogRepository', () => {
  it.each([
    ['in full', 'object', 'https://github.com/acme/monorepo'],
    ['as a shorthand', 'shorthand', 'https://gitlab.com/acme/monorepo'],
  ])('answers the repository the root manifest states %s', (_case, workspace, baseUrl) => {
    expect(changelogRepository(join(workspaces.path, workspace))).toEqual(expect.objectContaining({ baseUrl }))
  })

  it.each([
    ['states no repository', 'silent'],
    ['states a repository without a url', 'unreadable'],
    ['does not parse', 'broken'],
    ['is missing', 'bare'],
  ])("leaves the repository to be inferred from the project's manifest and the remote where the root manifest %s", (_case, workspace) => {
    expect(changelogRepository(join(workspaces.path, workspace))).toBe('inferred')
  })
})
