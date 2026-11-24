import type { ServicePlan } from './options-check'
import { readdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { checkOutput, collectAssets, copyServiceAssets, discardOutput, startOutput } from './output'

const REFUSAL = 'the output directory dist/apps/hello holds something this build did not write; remove it or name another outputPath.'

const workspace = useTempDir({
  prefix: 'service-output-',
  tree: {
    'apps/hello/src/main.ts': '',
    'apps/hello/src/assets/notice.txt': 'a notice\n',
    'apps/hello/src/assets/deep/more.txt': 'more\n',
    'apps/hello/src/hf-release.json': '{}',
    'apps/hello/src/main.cjs': '',
    'apps/hello/src/service.manifest.json': '{}',
  },
})

/**
 * Prepares the output directory of the service `@fixture/hello`.
 *
 * @returns The names the directory holds afterwards, or the message of the refusal
 */
function prepared(): readonly string[] | string {
  try {
    checkOutput(workspace.resolve('dist/apps/hello'), 'dist/apps/hello', '@fixture/hello')
    startOutput(workspace.resolve('dist/apps/hello'), '@fixture/hello')
    return readdirSync(workspace.resolve('dist/apps/hello'))
  } catch (error) {
    return (error as Error).message
  }
}

/**
 * The assets some globs match in the fixture's sources.
 *
 * @param globs - What the `assets` option holds
 * @returns The matched files and a line per problem
 */
function collected(globs: readonly string[]): ReturnType<typeof collectAssets> {
  return collectAssets(workspace.resolve('apps/hello/src'), globs)
}

describe('checkOutput and startOutput', () => {
  it('creates a directory that is absent, holding the stub that marks it as this build', () => {
    expect(prepared()).toEqual(['hf-release.json'])
  })

  it('accepts a directory that is empty', () => {
    workspace.mkdir('dist/apps/hello')
    expect(prepared()).toEqual(['hf-release.json'])
  })

  it('empties a previous build of the same service', () => {
    workspace.writeTree({ 'dist/apps/hello/hf-release.json': { name: '@fixture/hello' }, 'dist/apps/hello/main.cjs': '' })
    expect(prepared()).toEqual(['hf-release.json'])
  })

  it('states the package name in the stub, and nothing a service could boot beside', () => {
    prepared()
    expect(workspace.readJson('dist/apps/hello/hf-release.json')).toEqual({ name: '@fixture/hello' })
  })

  it('builds over a build that was interrupted before its release manifest was written', () => {
    prepared()
    workspace.write('dist/apps/hello/main.cjs', 'half a build')
    expect(prepared()).toEqual(['hf-release.json'])
  })

  it('refuses a directory with a file and no release manifest', () => {
    workspace.write('dist/apps/hello/keep.txt', 'mine')
    expect(prepared()).toBe(REFUSAL)
  })

  it('refuses a release manifest of another name', () => {
    workspace.write('dist/apps/hello/hf-release.json', { name: '@fixture/other' })
    expect(prepared()).toBe(REFUSAL)
  })

  it.each([
    ['does not parse', '{'],
    ['holds no object', 'null'],
  ])('refuses a release manifest that %s', (_, text) => {
    workspace.write('dist/apps/hello/hf-release.json', text)
    expect(prepared()).toBe(REFUSAL)
  })

  it('refuses a file where the directory is to be', () => {
    workspace.write('dist/apps/hello', 'a file')
    expect(prepared()).toBe(REFUSAL)
  })

  it('refuses a directory below a file', () => {
    workspace.write('dist/apps', 'a file')
    expect(prepared()).toBe(REFUSAL)
  })

  it('changes nothing of a directory it accepts until the build starts it', () => {
    workspace.writeTree({ 'dist/apps/hello/hf-release.json': { name: '@fixture/hello' }, 'dist/apps/hello/main.cjs': 'the previous build' })
    checkOutput(workspace.resolve('dist/apps/hello'), 'dist/apps/hello', '@fixture/hello')
    expect(workspace.read('dist/apps/hello/main.cjs')).toBe('the previous build')
  })

  it('collects a hidden file as an asset', () => {
    workspace.write('apps/hello/src/assets/.well-known/security.txt', 'contact\n')
    expect(collectAssets(workspace.resolve('apps/hello/src'), ['assets/.well-known/*']).files).toEqual(['assets/.well-known/security.txt'])
  })

  it('leaves what a refused directory holds', () => {
    workspace.write('dist/apps/hello/keep.txt', 'mine')
    prepared()
    expect(workspace.read('dist/apps/hello/keep.txt')).toBe('mine')
  })
})

describe('collectAssets', () => {
  it('collects nothing without a glob', () => {
    expect(collected([])).toEqual({ files: [], problems: [] })
  })

  it('collects every file a glob matches, a nested one at its relative path', () => {
    expect(collected(['assets/**'])).toEqual({ files: ['assets/deep/more.txt', 'assets/notice.txt'], problems: [] })
  })

  it('collects a file two globs match once', () => {
    expect(collected(['assets/notice.txt', 'assets/*.txt'])).toEqual({ files: ['assets/notice.txt'], problems: [] })
  })

  it('reports a glob that matches nothing by its index', () => {
    expect(collected(['assets/**', 'missing/**'])).toEqual({
      files: ['assets/deep/more.txt', 'assets/notice.txt'],
      problems: ['"assets[1]" matches no file.'],
    })
  })

  it.each(['main.cjs', 'service.manifest.json', 'hf-release.json'])('reports a match on %s, a name the build writes', (name) => {
    expect(collected([name])).toEqual({ files: [], problems: [`"assets[0]" matches ${name}, a name the build writes.`] })
  })

  it('reports a match on a name the build writes in another case, which a file system that ignores case would copy over it', () => {
    // why: a directory of its own, since beside the fixture's lower-case file the name would be the same file where case is ignored
    workspace.write('other/src/Service.Manifest.json', '{}')
    expect(collectAssets(workspace.resolve('other/src'), ['**'])).toEqual({
      files: [],
      problems: ['"assets[0]" matches Service.Manifest.json, a name the build writes.'],
    })
  })

  it('follows no link out of the sources', () => {
    workspace.write('elsewhere/secret.txt', 'not an asset')
    // why: a junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere
    symlinkSync(workspace.resolve('elsewhere'), workspace.resolve('apps/hello/src/assets/linked'), 'junction')
    expect(collected(['assets/**']).files).toEqual(['assets/deep/more.txt', 'assets/notice.txt'])
  })
})

describe('copyServiceAssets', () => {
  const plan = (): ServicePlan =>
    ({ sourceRoot: workspace.resolve('apps/hello/src'), outputPath: workspace.resolve('dist/apps/hello') }) as ServicePlan

  it('copies each file to its path relative to the entry module', () => {
    copyServiceAssets(plan(), ['assets/deep/more.txt'])
    expect(workspace.read('dist/apps/hello/assets/deep/more.txt')).toBe('more\n')
  })

  it('writes nothing when there is no asset', () => {
    copyServiceAssets(plan(), [])
    expect(workspace.exists('dist')).toBe(false)
  })
})

describe('discardOutput', () => {
  it('removes a directory and what it holds', () => {
    workspace.write('dist/apps/hello/main.cjs', '')
    discardOutput(workspace.resolve('dist/apps/hello'), 'dist/apps/hello')
    expect(workspace.exists('dist/apps/hello')).toBe(false)
  })

  it('answers empty text once the directory is gone, an absent one included', () => {
    expect(discardOutput(join(workspace.path, 'dist/absent'), 'dist/absent')).toBe('')
  })

  it('says so, and throws nothing, when the directory cannot be removed', () => {
    // why: a path that holds a NUL byte is refused by Node.js on every platform before the disk is touched
    expect(discardOutput(join(workspace.path, 'dist', 'a\0b'), 'dist/apps/hello')).toBe(
      '\nthe output directory dist/apps/hello could not be removed: it holds an unfinished build and must not be deployed.'
    )
  })
})
