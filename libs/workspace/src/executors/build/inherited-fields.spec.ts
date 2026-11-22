import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { inheritFields } from '@hyperfrontend/builder/package/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { INHERITED_FIELDS, inheritedFrom, packageRepository } from './inherited-fields'

const REPOSITORY = { type: 'git', url: 'git+https://example.test/acme.git' }

const BUGS = { url: 'https://example.test/acme/issues' }

const HOMEPAGE = 'https://example.test/acme#readme'

const AUTHOR = { name: 'Acme', url: 'https://example.test' }

const EVERY_FIELD = ['repository', 'bugs', 'homepage', 'author']

describe('INHERITED_FIELDS', () => {
  it('names the four fields a built package takes from the root manifest', () => {
    expect(INHERITED_FIELDS).toEqual(EVERY_FIELD)
  })
})

describe('packageRepository', () => {
  it("adds the project's directory to the repository the root states, every other key kept", () => {
    expect(packageRepository({ ...REPOSITORY, web: 'https://example.test' }, 'libs/core')).toEqual({
      ...REPOSITORY,
      web: 'https://example.test',
      directory: 'libs/core',
    })
  })

  it.each([
    ['a nested project root', 'libs/utils/beta', 'libs/utils/beta'],
    ['a project root written the way Windows writes paths', 'libs\\utils\\beta', 'libs/utils/beta'],
    ['a project root with a leading ./', './libs/core', 'libs/core'],
    ['a project root with a trailing slash', 'libs/core/', 'libs/core'],
  ])('writes the directory in POSIX form for %s', (_case, projectRoot, directory) => {
    expect(packageRepository(REPOSITORY, projectRoot)).toEqual({ ...REPOSITORY, directory })
  })

  it.each([
    ['as it is', 'packages/acme', 'packages/acme/libs/core'],
    ['with a leading ./ and a trailing slash', './packages/acme/', 'packages/acme/libs/core'],
    ['the way Windows writes paths', 'packages\\acme', 'packages/acme/libs/core'],
    ['as the root of the repository itself', '.', 'libs/core'],
  ])("joins the directory the root's repository states %s in front of the project's", (_case, stated, directory) => {
    expect(packageRepository({ ...REPOSITORY, directory: stated }, 'libs/core')).toEqual({ ...REPOSITORY, directory })
  })

  it("writes the project's directory alone where the root states a directory that is no text", () => {
    expect(packageRepository({ ...REPOSITORY, directory: 7 }, 'libs/core')).toEqual({ ...REPOSITORY, directory: 'libs/core' })
  })

  it.each([
    ['the workspace root written as a dot', '.'],
    ['the workspace root written as nothing', ''],
    ['the workspace root written as ./', './'],
  ])("answers the root's repository itself for a project at %s", (_case, projectRoot) => {
    const root = { ...REPOSITORY, directory: 'packages/acme' }
    expect(packageRepository(root, projectRoot)).toBe(root)
  })

  it.each([
    ['climbs out of the workspace', '../outside'],
    ['climbs out the way Windows writes paths', '..\\outside'],
    ['climbs on its way to a directory inside', 'libs/../libs/core'],
  ])("answers the root's repository itself for a project root that %s", (_case, projectRoot) => {
    expect(packageRepository(REPOSITORY, projectRoot)).toBe(REPOSITORY)
  })

  it.each([
    ['one string', 'github:acme/acme'],
    ['a list', [REPOSITORY.url]],
    ['an object without a url', { type: 'git' }],
    ['an object whose url is no text', { type: 'git', url: 7 }],
    ['null', null],
    ['nothing', undefined],
  ])('answers what the root states, untouched, where it states %s', (_case, stated) => {
    expect(packageRepository(stated, 'libs/core')).toBe(stated)
  })
})

describe('inheritedFrom', () => {
  const workspaces = useTempDir({
    prefix: 'build-inherited-',
    tree: {
      [join('object', 'package.json')]: { name: 'acme', repository: REPOSITORY, bugs: BUGS, homepage: HOMEPAGE, author: AUTHOR, license: 'MIT' },
      [join('object', 'libs', 'wrong', 'package.json')]: {
        name: '@acme/wrong',
        repository: { type: 'git', url: 'git+https://example.test/fork.git', directory: 'libs/elsewhere' },
        bugs: 'https://example.test/fork/issues',
      },
      [join('object', '.hf', 'build', 'libs', 'stale', 'inherited.json')]: '{ "repository": "github:acme/earlier" }\n',
      [join('nested', 'package.json')]: { name: 'acme', repository: { ...REPOSITORY, directory: 'packages/acme' } },
      [join('sparse', 'package.json')]: { name: 'acme', repository: REPOSITORY },
      [join('string', 'package.json')]: { name: 'acme', repository: 'github:acme/acme', bugs: BUGS },
      [join('silent', 'package.json')]: { name: 'acme', bugs: BUGS },
      [join('broken', 'package.json')]: '{ "repository": ',
      [join('bare', 'libs', 'core', 'keep.txt')]: '',
    },
  })

  /**
   * The source a build of one project inherits from.
   *
   * @param workspace - The fixture workspace, by the directory it lives in
   * @param projectRoot - The project's root as its configuration states it
   * @returns What the builder is handed
   */
  function source(workspace: string, projectRoot: string): ReturnType<typeof inheritedFrom> {
    return inheritedFrom(join(workspaces.path, workspace), projectRoot)
  }

  it('hands the builder a source of its own for the project, under the state directory of the workspace', () => {
    expect(source('object', 'libs/core')).toEqual({
      from: join(workspaces.path, 'object', '.hf', 'build', 'libs', 'core', 'inherited.json'),
      fields: EVERY_FIELD,
    })
  })

  it("writes the root's four fields there, the repository with the project's directory, as formatted JSON", () => {
    source('object', 'libs/core')
    expect(workspaces.read(join('object', '.hf', 'build', 'libs', 'core', 'inherited.json'))).toBe(
      [
        '{',
        '  "repository": {',
        '    "type": "git",',
        '    "url": "git+https://example.test/acme.git",',
        '    "directory": "libs/core"',
        '  },',
        '  "bugs": {',
        '    "url": "https://example.test/acme/issues"',
        '  },',
        '  "homepage": "https://example.test/acme#readme",',
        '  "author": {',
        '    "name": "Acme",',
        '    "url": "https://example.test"',
        '  }',
        '}',
        '',
      ].join('\n')
    )
  })

  it('writes the same bytes on every build of the same workspace', () => {
    source('object', 'libs/core')
    const first = workspaces.read(join('object', '.hf', 'build', 'libs', 'core', 'inherited.json'))
    source('object', 'libs/core')
    expect(workspaces.read(join('object', '.hf', 'build', 'libs', 'core', 'inherited.json'))).toBe(first)
  })

  it('leaves out a field the root manifest does not state', () => {
    source('sparse', 'libs/core')
    expect(workspaces.readJson(join('sparse', '.hf', 'build', 'libs', 'core', 'inherited.json'))).toEqual({
      repository: { ...REPOSITORY, directory: 'libs/core' },
    })
  })

  it("joins a directory the root's repository states in front of the project's", () => {
    source('nested', 'libs/core')
    expect(workspaces.readJson(join('nested', '.hf', 'build', 'libs', 'core', 'inherited.json'))).toEqual({
      repository: { ...REPOSITORY, directory: 'packages/acme/libs/core' },
    })
  })

  it('keeps one source per project, a nested project root in a directory of its own', () => {
    source('object', 'libs/core')
    source('object', 'libs/utils/beta')
    expect(workspaces.readJson(join('object', '.hf', 'build', 'libs', 'utils', 'beta', 'inherited.json'))).toEqual(
      expect.objectContaining({ repository: { ...REPOSITORY, directory: 'libs/utils/beta' } })
    )
  })

  it('places the source of a project root written the way Windows writes paths where the POSIX one goes', () => {
    expect(source('object', 'libs\\utils\\beta').from).toBe(
      join(workspaces.path, 'object', '.hf', 'build', 'libs', 'utils', 'beta', 'inherited.json')
    )
  })

  it('writes over the source an earlier build left', () => {
    source('object', 'libs/stale')
    expect(workspaces.readJson(join('object', '.hf', 'build', 'libs', 'stale', 'inherited.json'))).toEqual(
      expect.objectContaining({ repository: { ...REPOSITORY, directory: 'libs/stale' } })
    )
  })

  it('leaves nothing beside the source it wrote', () => {
    source('object', 'libs/core')
    expect(readdirSync(join(workspaces.path, 'object', '.hf', 'build', 'libs', 'core'))).toEqual(['inherited.json'])
  })

  it("builds the root's fields for a package whose own manifest states others", () => {
    const own = workspaces.readJson<Record<string, unknown>>(join('object', 'libs', 'wrong', 'package.json'))
    expect(inheritFields(own, source('object', 'libs/wrong'))).toEqual({
      name: '@acme/wrong',
      repository: { ...REPOSITORY, directory: 'libs/wrong' },
      bugs: BUGS,
      homepage: HOMEPAGE,
      author: AUTHOR,
    })
  })

  it("builds the package's own value for a field the root manifest does not state", () => {
    const own = workspaces.readJson<Record<string, unknown>>(join('object', 'libs', 'wrong', 'package.json'))
    expect(inheritFields(own, source('sparse', 'libs/wrong'))).toEqual({
      name: '@acme/wrong',
      repository: { ...REPOSITORY, directory: 'libs/wrong' },
      bugs: 'https://example.test/fork/issues',
    })
  })

  it.each([
    ['states its repository as one string', 'string', 'libs/core'],
    ['states no repository', 'silent', 'libs/core'],
    ['does not parse', 'broken', 'libs/core'],
    ['is missing', 'bare', 'libs/core'],
    ['is the manifest of the project itself', 'object', '.'],
    ['is left behind by a project root that climbs out of the workspace', 'object', '../outside'],
  ])('hands the builder the root manifest itself where it %s', (_case, workspace, projectRoot) => {
    expect(source(workspace, projectRoot)).toEqual({ from: join(workspaces.path, workspace, 'package.json'), fields: EVERY_FIELD })
  })

  it.each([
    ['states its repository as one string', 'string', 'libs/core'],
    ['states no repository', 'silent', 'libs/core'],
    ['does not parse', 'broken', 'libs/core'],
    ['is missing', 'bare', 'libs/core'],
  ])('writes nothing into a workspace whose root manifest %s', (_case, workspace, projectRoot) => {
    source(workspace, projectRoot)
    expect(workspaces.exists(join(workspace, '.hf'))).toBe(false)
  })

  it('writes no source outside the directory of derived sources for a project root that climbs out of it', () => {
    source('object', '../outside')
    expect(workspaces.exists(join('object', '.hf', 'outside'))).toBe(false)
  })

  it('writes no source for a project at the workspace root', () => {
    source('object', '.')
    expect(workspaces.exists(join('object', '.hf', 'build', 'inherited.json'))).toBe(false)
  })

  it('answers a list of fields of its own on every call', () => {
    source('silent', 'libs/core').fields.push('license')
    expect(source('silent', 'libs/core').fields).toEqual(EVERY_FIELD)
  })
})
