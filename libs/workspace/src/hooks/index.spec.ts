import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import {
  aliasTarget,
  completeRelative,
  formatOf,
  homeOf,
  installAliases,
  installFrom,
  isWorkspaceSource,
  readSources,
  resolveWorkspace,
  workspaceRootFrom,
} from './index.ts'

const THIS_FILE = resolve(import.meta.dirname, 'index.spec.ts')
const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')
const SOURCES = readSources(ROOT)

/** A second workspace: an alias, a module importing a sibling without its extension, and nothing else. */
const other = createTempDir({
  prefix: 'hooks-other-',
  tree: {
    'hf.json': '{}',
    'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@other/tool": ["tools/tool/src/index.ts"] } } }',
    'tools/tool/src/index.ts': "export { value } from './value'\n",
    'tools/tool/src/value.ts': 'export const value: number = 7\n',
    'nested/deep/keep.txt': '',
  },
})

/** A directory with no workspace above it, and a workspace with no base tsconfig. */
const bare = createTempDir({ prefix: 'hooks-bare-', tree: { 'plain/keep.txt': '', 'workspace/hf.json': '{}' } })

describe('workspaceRootFrom', () => {
  it('finds the nearest directory above that holds the workspace file', () => {
    expect(workspaceRootFrom(join(other.path, 'nested', 'deep'))).toBe(other.path)
  })

  it('answers null where no directory above holds one', () => {
    expect(workspaceRootFrom(join(bare.path, 'plain'))).toBeNull()
  })
})

describe('homeOf', () => {
  it('names the workspace a source module lives in', () => {
    expect(homeOf(import.meta.dirname)).toBe(ROOT)
  })

  it('names none for a module of an installed package, whatever workspace installed it', () => {
    expect(homeOf(join(ROOT, 'node_modules', '@hyperfrontend', 'workspace', 'hooks'))).toBeNull()
  })

  it('names none for a directory with no workspace above it', () => {
    expect(homeOf(join(bare.path, 'plain'))).toBeNull()
  })
})

describe('readSources', () => {
  it('reads the path aliases of the base tsconfig', () => {
    expect(readSources(other.path)).toEqual({ root: other.path, aliases: { '@other/tool': ['tools/tool/src/index.ts'] } })
  })

  it('reads no aliases from a workspace without a base tsconfig', () => {
    expect(readSources(join(bare.path, 'workspace'))).toEqual({ root: join(bare.path, 'workspace'), aliases: {} })
  })
})

describe('aliasTarget', () => {
  it('maps an alias to its source file', () => {
    expect(aliasTarget(SOURCES, '@hyperfrontend/testing')).toBe(join(ROOT, 'libs', 'testing', 'src', 'index.ts'))
  })

  it('answers null for a name that is no alias', () => {
    expect(aliasTarget(SOURCES, 'node:fs')).toBeNull()
  })
})

describe('isWorkspaceSource', () => {
  it('accepts a TypeScript file inside the workspace', () => {
    expect(isWorkspaceSource(ROOT, THIS_FILE)).toBe(true)
  })

  it('rejects a file under node_modules', () => {
    expect(isWorkspaceSource(ROOT, join(ROOT, 'node_modules', 'x', 'index.ts'))).toBe(false)
  })

  it('rejects a JavaScript file', () => {
    expect(isWorkspaceSource(ROOT, join(ROOT, 'tools', 'scripts', 'cz.mjs'))).toBe(false)
  })

  it('rejects a file of another workspace', () => {
    expect(isWorkspaceSource(ROOT, join(other.path, 'tools', 'tool', 'src', 'index.ts'))).toBe(false)
  })
})

describe('completeRelative', () => {
  it('ignores a bare specifier', () => {
    expect(completeRelative('node:path', THIS_FILE)).toBeNull()
  })

  it('leaves a specifier that names a file as written', () => {
    expect(completeRelative('./index.ts', THIS_FILE)).toBeNull()
  })

  it('appends .ts to a sibling module', () => {
    expect(completeRelative('./index.spec', THIS_FILE)).toBe(THIS_FILE)
  })

  it('completes a directory to its index.ts', () => {
    expect(completeRelative('../../../../libs/testing/src', THIS_FILE)).toBe(join(ROOT, 'libs', 'testing', 'src', 'index.ts'))
  })

  it('answers null when nothing completes', () => {
    expect(completeRelative('./no-such-module', THIS_FILE)).toBeNull()
  })
})

describe('resolveWorkspace', () => {
  it('answers an alias with its file URL', () => {
    expect(resolveWorkspace(SOURCES, '@hyperfrontend/testing', undefined)).toBe(
      pathToFileURL(join(ROOT, 'libs', 'testing', 'src', 'index.ts')).href
    )
  })

  it('answers null without a parent', () => {
    expect(resolveWorkspace(SOURCES, './index.spec', undefined)).toBeNull()
  })

  it('answers null for a parent that is no file', () => {
    expect(resolveWorkspace(SOURCES, './index.spec', 'node:internal')).toBeNull()
  })

  it('answers null for a parent outside the workspace sources', () => {
    expect(resolveWorkspace(SOURCES, './index.spec', pathToFileURL(join(ROOT, 'node_modules', 'x', 'index.ts')).href)).toBeNull()
  })

  it('completes a relative import from a workspace source', () => {
    expect(resolveWorkspace(SOURCES, './index.spec', pathToFileURL(THIS_FILE).href)).toBe(pathToFileURL(THIS_FILE).href)
  })

  it('answers null for a relative import that completes to nothing', () => {
    expect(resolveWorkspace(SOURCES, './no-such-module', pathToFileURL(THIS_FILE).href)).toBeNull()
  })
})

describe('formatOf', () => {
  it('declares a workspace source a TypeScript module', () => {
    expect(formatOf(ROOT, pathToFileURL(THIS_FILE).href)).toBe('module-typescript')
  })

  it('leaves a built-in module without a format', () => {
    expect(formatOf(ROOT, 'node:path')).toBeNull()
  })

  it('leaves a file outside the workspace sources without a format', () => {
    expect(formatOf(ROOT, pathToFileURL(join(ROOT, 'node_modules', 'x', 'index.js')).href)).toBeNull()
  })
})

describe('the installed hooks', () => {
  it('load a source of the workspace these sources live in, installed when the module was imported', async () => {
    const module = (await import('../runner/refusal.ts')) as { refusal: unknown }
    expect(typeof module.refusal).toBe('function')
  })

  it('resolve an alias of that workspace', () => {
    expect(import.meta.resolve('@hyperfrontend/testing')).toBe(pathToFileURL(join(ROOT, 'libs', 'testing', 'src', 'index.ts')).href)
  })

  it('leave a built-in module to Node', () => {
    expect(import.meta.resolve('node:path')).toBe('node:path')
  })

  it('leave the loading of an installed package to Node', () => {
    const manifest = createRequire(import.meta.url)(join(ROOT, 'node_modules', 'typescript', 'package.json')) as { name: string }
    expect(manifest.name).toBe('typescript')
  })

  it('resolve an alias of a second workspace once it is installed, and complete its relative imports', async () => {
    installFrom(join(other.path, 'nested'))
    installAliases(other.path)
    const module = (await import(import.meta.resolve('@other/tool'))) as { value: number }
    expect(module.value).toBe(7)
  })

  it('install nothing from a directory with no workspace above it', () => {
    installFrom(join(bare.path, 'plain'))
    expect(() => import.meta.resolve('@other/absent')).toThrow()
  })
})
