import type { FileImport } from './model'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { importsOfFiles, importsOfText, isCodeFile, readerVersion } from './imports'

const root = createGraphWorkspace()

/**
 * The specifiers and kinds of a text's imports, compactly.
 *
 * @param text - The code
 * @param file - The file name
 * @returns One `specifier` or `specifier!` (dynamic) per import
 */
function kinds(text: string, file = 'a.ts'): string[] {
  return (importsOfText(text, file) ?? []).map((item) => (item.dynamic ? `${item.specifier}!` : item.specifier))
}

describe('isCodeFile', () => {
  it('accepts the code extensions outside node_modules', () => {
    expect([isCodeFile('a/b.tsx'), isCodeFile('a/b.cjs'), isCodeFile('a/b.md'), isCodeFile('node_modules/x/b.js')]).toEqual([
      true,
      true,
      false,
      false,
    ])
  })
})

describe('importsOfText', () => {
  it('reads declarations and re-exports as static', () => {
    expect(kinds("import 'a'\nexport { x } from 'b'\nexport * from 'c'\nexport const y = 1\nimport z = require('d')\n")).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('reads dynamic imports and type-alias import types as dynamic', () => {
    expect(kinds("const p = import('a')\ntype Q = import('b').Q\nlet r: import('c').R\n")).toEqual(['a!', 'b!', 'c'])
  })

  it('reads top-level require calls as static', () => {
    expect(
      kinds("const a = require('a')\nconst b = require.resolve('b')\nfunction f() { { require('c') } }\nif (x) require('d')\n")
    ).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reads require calls under other braces as dynamic', () => {
    expect(
      kinds(
        "if (x) { require('a') }\nconst f = () => { require('b') }\nswitch (x) { case 1: require('c') }\nclass K { m() { require('d') } }\n"
      )
    ).toEqual(['a!', 'b!', 'c!', 'd!'])
  })

  it('ignores calls that are not module loads', () => {
    expect(kinds("require(name)\nrequire.cache['a']\nload('b')\nrequire.other('c')\nx.require('d')\nrequire['resolve']('e')\n")).toEqual([])
  })

  it('reads nothing from a file that does not parse', () => {
    expect(kinds('const = \n')).toEqual([])
  })

  it('reads a declaration file', () => {
    expect(kinds("import type { A } from 'a'\n", 'a.d.ts')).toEqual(['a'])
  })
})

/**
 * The form, type-only flag and names of a text's imports, compactly.
 *
 * @param text - The code
 * @returns One `kind[names]` or `kind type-only[names]` per import
 */
function forms(text: string): string[] {
  return (importsOfText(text, 'a.ts') ?? []).map((item) => `${item.kind}${item.typeOnly ? ' type-only' : ''}[${item.names.join(',')}]`)
}

describe('importsOfText forms', () => {
  it('reads side-effect, type-only, mixed, default and namespace imports with their names', () => {
    expect(
      forms(
        "import 'a'\nimport type { A } from 'b'\nimport { type A, type B } from 'c'\nimport { A, type B as C } from 'd'\nimport D, * as ns from 'e'\nimport { 'string name' as s } from 'f'\n"
      )
    ).toEqual(['side-effect[]', 'type type-only[A]', 'type type-only[A,B]', 'value[A,B]', 'value[default,*]', 'value[string name]'])
  })

  it('reads named, type-only, star and namespace re-exports', () => {
    expect(
      forms("export { x as y } from 'g'\nexport type { T } from 'h'\nexport * from 'i'\nexport * as ns from 'j'\nexport type * from 'k'\n")
    ).toEqual(['value[x]', 'type type-only[T]', 're-export-all[]', 'value[*]', 're-export-all type-only[]'])
  })

  it('reads import equals, import types, dynamic imports and require calls', () => {
    expect(
      forms("import x = require('l')\nimport type y = require('m')\ntype Q = import('n').Q\nconst p = import('o')\nrequire('q')\n")
    ).toEqual(['value[*]', 'type type-only[*]', 'type type-only[]', 'dynamic[]', 'value[]'])
  })

  it('records the line and column of each import', () => {
    expect(
      (importsOfText("\nimport 'a'\nconst x = () => import('b')\n", 'a.ts') ?? []).map((item) => `${item.line}:${item.column}`)
    ).toEqual(['2:1', '3:17'])
  })
})

describe('readerVersion', () => {
  it('names the installed parser version where the workspace does not alias the parser to source', () => {
    const installed = createTempDir({
      prefix: 'reader-installed-',
      tree: { 'node_modules/@hyperfrontend/linter/package.json': '{ "version": "1.2.3" }' },
    })
    expect(readerVersion(installed.path)).toBe('2:1.2.3')
  })

  it('hashes the aliased parser sources, specs left out', () => {
    const aliased = createTempDir({
      prefix: 'reader-aliased-',
      tree: {
        'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@hyperfrontend/linter": ["libs/linter/src/index.ts"] } } }',
        'libs/linter/src/code/b.ts': 'export const b = 1\n',
        'libs/linter/src/code/a.ts': 'export const a = 1\n',
        'libs/linter/src/code/a.spec.ts': 'spec\n',
        'libs/linter/src/code/notes.md': 'notes\n',
      },
    })
    const hash = createHash('sha1').update('export const a = 1\n').update('export const b = 1\n').digest('hex')
    expect(readerVersion(aliased.path)).toBe(`2:${hash}`)
  })

  it('answers unknown for an alias naming no sources beside an installed parser without a version', () => {
    const empty = createTempDir({
      prefix: 'reader-empty-',
      tree: {
        'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@hyperfrontend/linter": ["libs/linter/src/index.ts"] } } }',
        'node_modules/@hyperfrontend/linter/package.json': '{ "name": "@hyperfrontend/linter" }',
      },
    })
    expect(readerVersion(empty.path)).toBe('2:unknown')
  })

  it('answers unknown without an alias or an installed parser, once per root', () => {
    expect([readerVersion(root), readerVersion(root) === readerVersion(root)]).toEqual(['2:unknown', true])
  })
})

/** Where the fixture workspace keeps the cache. */
const CACHE = join(root, 'node_modules/.cache/hyperfrontend-lint/imports.json')

/** The cache as written. */
interface Cache {
  readonly version: string
  readonly marker?: number
  readonly files: Record<string, { stamp: string; hash: string; imports: unknown[] }>
}

/**
 * Reads the fixture's cache.
 *
 * @returns The parsed file, its version and entries by path
 */
function readCache(): Cache {
  return parse(readFileSync(CACHE, 'utf8')) as Cache
}

/**
 * Remembers other imports for one file, under its current stamp and hash or broken ones.
 *
 * @param file - The workspace-relative file
 * @param keep - Which of its stamp and hash stay true
 */
function rememberOther(file: string, keep: 'stamp' | 'hash'): void {
  importsOfFiles(root, [file])
  const cache = readCache()
  const stats = statSync(join(root, file))
  const hash = createHash('sha1')
    .update(readFileSync(join(root, file), 'utf8'))
    .digest('hex')
  const entry = { stamp: keep === 'stamp' ? `${stats.size}:${stats.mtimeMs}` : 'moved', hash: keep === 'stamp' ? 'other' : hash }
  writeFileSync(
    CACHE,
    JSON.stringify({ ...cache, files: { [file]: { ...entry, imports: [{ specifier: 'remembered', dynamic: false }] } } })
  )
}

describe('importsOfFiles', () => {
  it('reads the code files only', () => {
    const imports = importsOfFiles(root, ['libs/a/src/index.ts', 'apps/app/README.md'])
    expect([...imports.keys()]).toEqual(['libs/a/src/index.ts'])
  })

  it('remembers each file with its stamp and hash', () => {
    importsOfFiles(root, ['libs/b/src/index.ts'])
    expect(Object.keys(readCache().files['libs/b/src/index.ts'] ?? {})).toEqual(['stamp', 'hash', 'imports'])
  })

  it('reuses the remembered imports of a file whose stamp is unchanged, without reading it', () => {
    rememberOther('libs/b/src/index.ts', 'stamp')
    expect(importsOfFiles(root, ['libs/b/src/index.ts']).get('libs/b/src/index.ts')).toEqual([{ specifier: 'remembered', dynamic: false }])
  })

  it('reuses the remembered imports of a file touched but unchanged in content', () => {
    rememberOther('libs/b/src/index.ts', 'hash')
    expect(importsOfFiles(root, ['libs/b/src/index.ts']).get('libs/b/src/index.ts')).toEqual([{ specifier: 'remembered', dynamic: false }])
  })

  it('leaves the cache unwritten when nothing changed', () => {
    importsOfFiles(root, ['libs/b/src/index.ts'])
    writeFileSync(CACHE, JSON.stringify({ ...readCache(), marker: 1 }))
    importsOfFiles(root, ['libs/b/src/index.ts'])
    expect(readCache().marker).toBe(1)
  })

  it('rewrites the cache when a remembered file is no longer asked about', () => {
    importsOfFiles(root, ['libs/a/src/index.ts', 'libs/b/src/index.ts'])
    importsOfFiles(root, ['libs/b/src/index.ts'])
    expect(Object.keys(readCache().files)).toEqual(['libs/b/src/index.ts'])
  })

  it('discards a cache another reader version wrote', () => {
    writeFileSync(
      CACHE,
      JSON.stringify({ version: 'other', files: { 'libs/b/src/index.ts': { stamp: '', hash: '', imports: [{ specifier: 'stale' }] } } })
    )
    expect(importsOfFiles(root, ['libs/b/src/index.ts']).get('libs/b/src/index.ts')).toEqual([])
  })

  it('reads every file afresh when the cache does not parse', () => {
    writeFileSync(CACHE, '{"version":')
    expect(importsOfFiles(root, ['libs/b/src/index.ts']).get('libs/b/src/index.ts')).toEqual([])
  })

  it('reads a file whose content changed', () => {
    importsOfFiles(root, ['libs/b/src/index.ts'])
    writeFileSync(join(root, 'libs/b/src/index.ts'), "import 'changed'\n")
    const changed: FileImport = {
      specifier: 'changed',
      dynamic: false,
      kind: 'side-effect',
      typeOnly: false,
      names: [],
      line: 1,
      column: 1,
    }
    expect(importsOfFiles(root, ['libs/b/src/index.ts']).get('libs/b/src/index.ts')).toEqual([changed])
  })

  it('leaves out a listed file that no longer exists', () => {
    expect([...importsOfFiles(root, ['libs/b/src/gone.ts']).keys()]).toEqual([])
  })

  it('counts a file that does not parse as importing nothing', () => {
    writeFileSync(join(root, 'libs/b/src/broken.ts'), "import { from 'x'\n")
    expect(importsOfFiles(root, ['libs/b/src/broken.ts']).get('libs/b/src/broken.ts')).toEqual([])
  })

  it('does not remember a file that does not parse', () => {
    importsOfFiles(root, ['libs/b/src/broken.ts'])
    expect(Object.keys(readCache().files)).toEqual([])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
