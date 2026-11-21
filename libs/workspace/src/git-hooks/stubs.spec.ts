import { join, sep, posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { planStubs, stubEntry, stubOf, stubOrigin, stubPlace } from './stubs'

/** A stub of this package. */
const OWN = stubOf('pre-commit', 'node_modules/@hyperfrontend/workspace/bin/hf.mjs')

/** A stub as Lefthook writes it. */
const LEFTHOOK = '#!/bin/sh\ncall_lefthook run "pre-commit" "$@"\n'

/** A stub somebody else wrote. */
const FOREIGN = '#!/bin/sh\ngit lfs pre-push "$@"\n'

describe('stubOf', () => {
  it('starts the hook through the entry module, with the arguments Git gave', () => {
    expect(OWN.split(/\r?\n/).slice(2)).toEqual([
      'exec node "node_modules/@hyperfrontend/workspace/bin/hf.mjs" hooks run pre-commit "$@"',
      '',
    ])
  })

  it('is a POSIX shell script', () => {
    expect(OWN.startsWith('#!/bin/sh\n# hf-hooks: ')).toBe(true)
  })

  it('keeps the shell from reading a path of the entry', () => {
    expect(stubOf('pre-push', 'a "b" $c `d` \\e/hf.mjs')).toContain('exec node "a \\"b\\" \\$c \\`d\\` \\\\e/hf.mjs" hooks run pre-push')
  })
})

describe('stubOrigin', () => {
  it.each([
    ['its own stub', OWN, 'own'],
    ['a stub of Lefthook', LEFTHOOK, 'lefthook'],
    ['any other file', FOREIGN, 'foreign'],
  ])('recognises %s', (_, content, origin) => {
    expect(stubOrigin(content)).toBe(origin)
  })
})

describe('planStubs', () => {
  it('writes every configured hook into an empty directory', () => {
    expect(planStubs(createMap(), ['pre-commit', 'pre-push'])).toEqual({ write: ['pre-commit', 'pre-push'], remove: [], foreign: [] })
  })

  it('rewrites its own stubs and takes the place of those of Lefthook', () => {
    expect(
      planStubs(
        createMap([
          ['pre-commit', OWN],
          ['pre-push', LEFTHOOK],
        ]),
        ['pre-commit', 'pre-push']
      )
    ).toEqual({ write: ['pre-commit', 'pre-push'], remove: [], foreign: [] })
  })

  it('removes its own and the Lefthook stubs of hooks that are not configured', () => {
    expect(
      planStubs(
        createMap([
          ['commit-msg', OWN],
          ['post-commit', LEFTHOOK],
        ]),
        ['pre-commit']
      )
    ).toEqual({ write: ['pre-commit'], remove: ['commit-msg', 'post-commit'], foreign: [] })
  })

  it('leaves a file somebody else wrote, and names the configured hook it occupies', () => {
    expect(
      planStubs(
        createMap([
          ['pre-push', FOREIGN],
          ['post-merge', FOREIGN],
        ]),
        ['pre-commit', 'pre-push']
      )
    ).toEqual({ write: ['pre-commit'], remove: [], foreign: ['pre-push'] })
  })
})

describe('stubPlace', () => {
  /**
   * Git at the root of a working tree with the hooks where it keeps them by default.
   *
   * @returns An empty prefix and the default hooks directory, as git prints them
   */
  const atRoot = (): string => '\n.git/hooks\n'

  it('is the hooks directory of the repository the workspace is the root of', () => {
    expect(stubPlace('/repo', {}, atRoot)).toEqual({ directory: '.git/hooks', reason: null })
  })

  it.each([['0'], ['false'], ['']])('takes CI=%s for a clone', (value) => {
    expect(stubPlace('/repo', { CI: value }, atRoot).directory).toBe('.git/hooks')
  })

  it('is nowhere, quietly, under CI', () => {
    expect(stubPlace('/repo', { CI: 'true' }, atRoot)).toEqual({ directory: null, reason: null })
  })

  it('is nowhere, quietly, outside a repository', () => {
    expect(
      stubPlace('/repo', {}, () => {
        throw createError('not a git repository')
      })
    ).toEqual({ directory: null, reason: null })
  })

  it('is nowhere, with the reason, in a workspace below the root of its repository', () => {
    expect(stubPlace('/repo/tools', {}, () => 'tools/\n../.git/hooks\n')).toEqual({
      directory: null,
      reason: 'the workspace is not at the root of its repository',
    })
  })

  it('is nowhere, with the reason, where Git reads the hooks from outside the workspace', () => {
    expect(stubPlace('/repo', {}, () => '\r\n/home/me/.githooks\r\n')).toEqual({
      directory: null,
      reason: 'git reads the hooks of this repository from /home/me/.githooks, outside the workspace',
    })
  })
})

describe('stubEntry', () => {
  const dir = useTempDir({
    tree: {
      'node_modules/@hyperfrontend/workspace/package.json': { name: '@hyperfrontend/workspace', bin: { hf: './bin/hf.mjs' } },
      'node_modules/@hyperfrontend/workspace/generators/hooks/package.json': { name: 'not-the-package' },
      'node_modules/@hyperfrontend/workspace/generators/hooks/index.mjs': '',
      'elsewhere/package.json': { name: '@hyperfrontend/workspace' },
      'empty/keep': '',
    },
  })

  it('is the hf executable of the package, from the workspace root', () => {
    expect(stubEntry(dir.path, join(dir.path, 'node_modules', '@hyperfrontend', 'workspace', 'generators', 'hooks'))).toBe(
      'node_modules/@hyperfrontend/workspace/bin/hf.mjs'
    )
  })

  it('is an absolute path for a package installed outside the workspace', () => {
    expect(stubEntry(join(dir.path, 'empty'), join(dir.path, 'node_modules', '@hyperfrontend', 'workspace'))).toBe(
      join(dir.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs').split(sep).join(posix.sep)
    )
  })

  it('refuses a directory no manifest of the package lies above', () => {
    expect(() => stubEntry(dir.path, join(dir.path, 'empty'))).toThrow(
      'no @hyperfrontend/workspace manifest with an hf executable at or above'
    )
  })

  it('refuses a manifest of the package that has no hf executable', () => {
    expect(() => stubEntry(dir.path, join(dir.path, 'elsewhere'))).toThrow(
      'no @hyperfrontend/workspace manifest with an hf executable at or above'
    )
  })
})
