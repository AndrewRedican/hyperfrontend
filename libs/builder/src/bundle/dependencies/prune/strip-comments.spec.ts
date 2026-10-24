import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { stripComments, stripCommentsPass } from './strip-comments'

describe('stripComments', () => {
  it('removes a banner, an eslint-disable pragma, and per-export JSDoc', () => {
    const source = [
      '/* source banner */',
      '/* eslint-disable @typescript-eslint/no-explicit-any */',
      '/** (Safe copy) of the value. */',
      'export const copy = 1;',
    ].join('\n')
    expect(stripComments(source)).toBe('export const copy = 1;')
  })

  it('removes a trailing line comment but leaves the code on its line', () => {
    expect(stripComments('export const a = 1; // trailing')).toBe('export const a = 1; ')
  })

  it('removes an inline block comment in place', () => {
    expect(stripComments('foo(/* inline */bar);')).toBe('foo(bar);')
  })

  it('keeps a @__PURE__ annotation', () => {
    const source = 'var x = /*@__PURE__*/ f();'
    expect(stripComments(source)).toBe(null)
  })

  it('keeps a #__PURE__ annotation', () => {
    expect(stripComments('var x = /*#__PURE__*/ f();')).toBe(null)
  })

  it('keeps a @__NO_SIDE_EFFECTS__ annotation', () => {
    expect(stripComments('/*@__NO_SIDE_EFFECTS__*/\nexport function f() {}')).toBe(null)
  })

  it('keeps a legal banner comment', () => {
    expect(stripComments('/*! (c) Acme — MIT */\nexport const a = 1;')).toBe(null)
  })

  it('strips a block lint pragma even when its text contains @preserve', () => {
    const source = ['/* lint-disable workspace/no-unsafe-builtin-methods -- @preserve: bootstrap */', 'export const a = 1;'].join('\n')
    expect(stripComments(source)).toBe('export const a = 1;')
  })

  it('strips a line lint pragma even when its text contains @preserve', () => {
    const source = ['// lint-disable-next-line no-plain-inline-comments -- @preserve: reason', 'export const a = 1;'].join('\n')
    expect(stripComments(source)).toBe('export const a = 1;')
  })

  it('strips a third-party eslint pragma even when its text contains @preserve', () => {
    const source = ['/* eslint-disable no-console -- @preserve: vendored */', 'export const a = 1;'].join('\n')
    expect(stripComments(source)).toBe('export const a = 1;')
  })

  it('keeps an @license comment while stripping an ordinary one beside it', () => {
    const source = ['/** @license MIT */', '/** ordinary */', 'export const a = 1;'].join('\n')
    expect(stripComments(source)).toBe('/** @license MIT */\nexport const a = 1;')
  })

  it('leaves a // sequence inside a string literal untouched', () => {
    const source = 'export const u = "// not a comment";\n// real'
    expect(stripComments(source)).toBe('export const u = "// not a comment";\n')
  })

  it('leaves a comment-looking sequence inside a template literal untouched', () => {
    const source = 'export const t = `x /* y */ z`;\n/* real */'
    expect(stripComments(source)).toBe('export const t = `x /* y */ z`;\n')
  })

  it('leaves a // inside a substitution template untouched and still strips the real comment after it', () => {
    // why: ts.Scanner needs reScanTemplateToken to resume a template across `${...}`; without it the `}` flips backtick polarity and the `//` in `https://` is mis-scanned as a comment (the bug that truncated the bundled rollup chunk).
    const source = 'const link = `https://aka.ms/${name}.exe`;\n// strip me'
    expect(stripComments(source)).toBe('const link = `https://aka.ms/${name}.exe`;\n')
  })

  it('keeps backtick polarity across two substitution templates in a row', () => {
    const source = ['const a = `x.${p}.y`;', 'const b = `https://h/${q}.z`;', '// gone'].join('\n')
    expect(stripComments(source)).toBe(['const a = `x.${p}.y`;', 'const b = `https://h/${q}.z`;', ''].join('\n'))
  })

  it('resumes a template after a brace-bearing substitution expression', () => {
    const source = 'const t = `a${ {k: 1} }b`; // tail'
    expect(stripComments(source)).toBe('const t = `a${ {k: 1} }b`; ')
  })

  it('handles a nested substitution template', () => {
    const source = 'const t = `a${ `b${c}d` }e`; /* gone */'
    expect(stripComments(source)).toBe('const t = `a${ `b${c}d` }e`; ')
  })

  it('does not mistake a regex body with escaped slashes for a comment', () => {
    const source = 'export const p = /https?:\\/\\//;\n// strip me'
    expect(stripComments(source)).toBe('export const p = /https?:\\/\\//;\n')
  })

  it('does not mistake a regex argument for a comment', () => {
    const source = 'export const s = str.split(/\\//g); /* keep nothing */'
    expect(stripComments(source)).toBe('export const s = str.split(/\\//g); ')
  })

  it('treats a slash after a value as division, not a regex', () => {
    const source = 'export const n = a / b / c; // gone'
    expect(stripComments(source)).toBe('export const n = a / b / c; ')
  })

  it('collapses the blank lines a full-line removal leaves behind', () => {
    const source = ['/* banner */', '', '', 'export const a = 1;'].join('\n')
    expect(stripComments(source)).toBe('export const a = 1;')
  })

  it('collapses a CRLF whole-line comment the same as the LF case', () => {
    const source = ['/* banner */', '', '', 'export const a = 1;'].join('\r\n')
    expect(stripComments(source)).toBe('export const a = 1;')
  })

  it('removes a whole-line comment that ends the file without a trailing newline', () => {
    expect(stripComments('export const a = 1;\n/* trailing */')).toBe('export const a = 1;\n')
  })

  it('swallows a trailing blank-line run that runs to end of file', () => {
    expect(stripComments('/* banner */\n   ')).toBe('')
  })

  it('returns null when there is nothing removable', () => {
    expect(stripComments('export const a = 1;')).toBe(null)
  })

  it('is idempotent on a second run', () => {
    const source = ['/** doc */', 'export const a = 1; // tail'].join('\n')
    const once = stripComments(source)
    expect({ firstRun: once, secondRun: stripComments(once as string) }).toEqual({ firstRun: 'export const a = 1; ', secondRun: null })
  })
})

describe('stripCommentsPass', () => {
  const depsParent = useTempDir({ prefix: 'builder-comment-strip-' })

  const depsRoot = (): string => depsParent.resolve('_dependencies')

  const write = (relPath: string, content: string): string => depsParent.write(join('_dependencies', relPath), content)

  const read = (relPath: string): string => depsParent.read(join('_dependencies', relPath))

  it('returns zero bytes when there is no _dependencies directory', () => {
    expect(stripCommentsPass(depsRoot())).toEqual({ commentBytesRemoved: 0 })
  })

  it('counts the bytes of the comments stripped from ESM and CJS chunks', () => {
    write('a/index.mjs', '/** doc */\nexport const a = 1;')
    write('a/index.cjs', '/** doc */\nexports.a = 1;')
    expect(stripCommentsPass(depsRoot())).toEqual({ commentBytesRemoved: Buffer.byteLength('/** doc */\n') * 2 })
  })

  it('strips ordinary comments from ESM and CJS chunks', () => {
    write('a/index.mjs', '/** doc */\nexport const a = 1;')
    write('a/index.cjs', '/** doc */\nexports.a = 1;')
    stripCommentsPass(depsRoot())
    expect({ esm: read('a/index.mjs'), cjs: read('a/index.cjs') }).toEqual({ esm: 'export const a = 1;', cjs: 'exports.a = 1;' })
  })

  it('counts nothing for non-chunk files and chunks with nothing removable', () => {
    write('a/index.mjs', 'export const a = 1;')
    write('a/index.d.ts', '/** kept */\nexport declare const a: number;')
    write('keep.txt', '// not a chunk')
    expect(stripCommentsPass(depsRoot())).toEqual({ commentBytesRemoved: 0 })
  })

  it('leaves the comments of a non-chunk file in place', () => {
    write('a/index.mjs', 'export const a = 1;')
    write('a/index.d.ts', '/** kept */\nexport declare const a: number;')
    write('keep.txt', '// not a chunk')
    stripCommentsPass(depsRoot())
    expect(read('a/index.d.ts')).toBe('/** kept */\nexport declare const a: number;')
  })

  it('is idempotent across two passes over the same tree', () => {
    write('a/index.mjs', '/** doc */\nexport const a = 1;')
    const firstPass = stripCommentsPass(depsRoot())
    const secondPass = stripCommentsPass(depsRoot())
    expect({ firstPass, secondPass }).toEqual({
      firstPass: { commentBytesRemoved: Buffer.byteLength('/** doc */\n') },
      secondPass: { commentBytesRemoved: 0 },
    })
  })
})
