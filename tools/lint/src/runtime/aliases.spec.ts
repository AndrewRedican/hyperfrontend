import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from '@hyperfrontend/testing'
import { WORKSPACE_ROOT, aliasTarget, completeRelative, formatOf, install, isWorkspaceSource, resolveWorkspace } from './aliases.ts'

const THIS_FILE = resolve(import.meta.dirname, 'aliases.spec.ts')

describe('WORKSPACE_ROOT', () => {
  it('names the directory that holds tsconfig.base.json', () => {
    expect(resolve(import.meta.dirname, '..', '..', '..', '..')).toBe(WORKSPACE_ROOT)
  })
})

describe('aliasTarget', () => {
  it('maps an alias to its source file', () => {
    expect(aliasTarget('@hyperfrontend/testing')).toBe(join(WORKSPACE_ROOT, 'libs', 'testing', 'src', 'index.ts'))
  })

  it('answers null for a name that is no alias', () => {
    expect(aliasTarget('node:fs')).toBeNull()
  })
})

describe('isWorkspaceSource', () => {
  it('accepts a TypeScript file inside the workspace', () => {
    expect(isWorkspaceSource(THIS_FILE)).toBe(true)
  })

  it('rejects a file under node_modules', () => {
    expect(isWorkspaceSource(join(WORKSPACE_ROOT, 'node_modules', 'x', 'index.ts'))).toBe(false)
  })

  it('rejects a JavaScript file', () => {
    expect(isWorkspaceSource(join(WORKSPACE_ROOT, 'tools', 'scripts', 'cz.mjs'))).toBe(false)
  })
})

describe('completeRelative', () => {
  it('ignores a bare specifier', () => {
    expect(completeRelative('node:path', THIS_FILE)).toBeNull()
  })

  it('leaves a specifier that names a file as written', () => {
    expect(completeRelative('./aliases.ts', THIS_FILE)).toBeNull()
  })

  it('appends .ts to a sibling module', () => {
    expect(completeRelative('./aliases', THIS_FILE)).toBe(resolve(import.meta.dirname, 'aliases.ts'))
  })

  it('completes a directory to its index.ts', () => {
    expect(completeRelative('../../../../libs/testing/src', THIS_FILE)).toBe(join(WORKSPACE_ROOT, 'libs', 'testing', 'src', 'index.ts'))
  })

  it('answers null when nothing completes', () => {
    expect(completeRelative('./no-such-module', THIS_FILE)).toBeNull()
  })
})

describe('resolveWorkspace', () => {
  it('answers an alias with its file URL', () => {
    expect(resolveWorkspace('@hyperfrontend/testing', undefined)).toBe(
      pathToFileURL(join(WORKSPACE_ROOT, 'libs', 'testing', 'src', 'index.ts')).href
    )
  })

  it('answers null without a parent', () => {
    expect(resolveWorkspace('./aliases', undefined)).toBeNull()
  })

  it('answers null for a parent that is no file', () => {
    expect(resolveWorkspace('./aliases', 'node:internal')).toBeNull()
  })

  it('answers null for a parent outside the workspace sources', () => {
    expect(resolveWorkspace('./aliases', pathToFileURL(join(WORKSPACE_ROOT, 'node_modules', 'x', 'index.ts')).href)).toBeNull()
  })

  it('completes a relative import from a workspace source', () => {
    expect(resolveWorkspace('./aliases', pathToFileURL(THIS_FILE).href)).toBe(
      pathToFileURL(resolve(import.meta.dirname, 'aliases.ts')).href
    )
  })

  it('answers null for a relative import that completes to nothing', () => {
    expect(resolveWorkspace('./no-such-module', pathToFileURL(THIS_FILE).href)).toBeNull()
  })
})

describe('formatOf', () => {
  it('declares a workspace source a TypeScript module', () => {
    expect(formatOf(pathToFileURL(THIS_FILE).href)).toBe('module-typescript')
  })

  it('leaves a built-in module without a format', () => {
    expect(formatOf('node:path')).toBeNull()
  })

  it('leaves a file outside the workspace sources without a format', () => {
    expect(formatOf(pathToFileURL(join(WORKSPACE_ROOT, 'node_modules', 'x', 'index.js')).href)).toBeNull()
  })
})

describe('install', () => {
  it('loads a workspace source through the registered hook', async () => {
    install()
    const module = (await import('../../scripts/lib/paths.ts')) as { say: unknown }
    expect(typeof module.say).toBe('function')
  })

  it('resolves an alias through the registered hook', () => {
    install()
    expect(import.meta.resolve('@hyperfrontend/testing')).toBe(
      pathToFileURL(join(WORKSPACE_ROOT, 'libs', 'testing', 'src', 'index.ts')).href
    )
  })

  it('leaves a built-in module to Node', () => {
    install()
    expect(import.meta.resolve('node:path')).toBe('node:path')
  })

  it('leaves the loading of an installed package to Node', () => {
    install()
    const manifest = createRequire(import.meta.url)(join(WORKSPACE_ROOT, 'node_modules', 'nx', 'package.json')) as { name: string }
    expect(manifest.name).toBe('nx')
  })
})
