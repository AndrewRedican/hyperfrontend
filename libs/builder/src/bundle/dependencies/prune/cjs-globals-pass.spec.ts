import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { shimCjsGlobalsPass } from './cjs-globals-pass'

describe('shimCjsGlobalsPass', () => {
  let depsRoot: string

  beforeEach(() => {
    depsRoot = join(mkdtempSync(join(tmpdir(), 'builder-cjs-globals-')), '_dependencies')
    mkdirSync(depsRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(depsRoot, '..'), { recursive: true, force: true })
  })

  const write = (relPath: string, content: string): string => {
    const abs = join(depsRoot, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
    return abs
  }

  it('returns a zero count when the deps root does not exist', () => {
    expect(shimCjsGlobalsPass(join(depsRoot, 'absent'))).toEqual({ chunksShimmed: 0 })
  })

  it('shims a chunk whose closure reads __dirname', () => {
    write('dep/index.esm.js', 'function locate() { return __dirname; }\nconst where = locate();\nexport { where };\n')
    expect(shimCjsGlobalsPass(depsRoot)).toEqual({ chunksShimmed: 1 })
  })

  it('prepends a createRequire-backed require binding', () => {
    const chunk = write(
      'dep/index.esm.js',
      "function load(id) { return require(id); }\nconst sep = load('node:path').sep;\nexport { sep };\n"
    )
    shimCjsGlobalsPass(depsRoot)
    expect(readFileSync(chunk, 'utf8')).toContain('const require = __cjsCreateRequire(import.meta.url);')
  })

  it('prepends a fileURLToPath-backed __filename binding', () => {
    const chunk = write('dep/index.esm.js', 'const self = __filename;\nexport { self };\n')
    shimCjsGlobalsPass(depsRoot)
    expect(readFileSync(chunk, 'utf8')).toContain('const __filename = __cjsFileURLToPath(import.meta.url);')
  })

  it('produces a chunk native ESM can evaluate', () => {
    const chunk = write(
      'dep/index.esm.js',
      "function load(id) { return require(id); }\nconst sep = load('node:path').sep;\nconst where = __dirname;\nexport { sep, where };\n"
    )
    shimCjsGlobalsPass(depsRoot)
    const out = execFileSync('node', [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(`file://${chunk}`)}); process.stdout.write(m.sep + '|' + (m.where.length > 0))`,
    ])
    expect(out.toString()).toBe('/|true')
  })

  it('aliases the shim helpers around a chunk that already uses their names', () => {
    const chunk = write('dep/index.esm.js', 'function f() { return __cjsFileURLToPath(__filename); }\nconst v = f();\nexport { v };\n')
    shimCjsGlobalsPass(depsRoot)
    expect(readFileSync(chunk, 'utf8')).toContain('fileURLToPath as __cjsFileURLToPath$1')
  })

  it('leaves a chunk alone when a local helper shadows require', () => {
    const source = 'function requireApi() { return 1; }\nconst api = requireApi();\nexport { api };\n'
    const chunk = write('dep/index.esm.js', source)
    shimCjsGlobalsPass(depsRoot)
    expect(readFileSync(chunk, 'utf8')).toBe(source)
  })

  it('leaves a chunk alone when a top-level binding supplies the name', () => {
    const source = "const __dirname = '/pinned';\nconst where = __dirname;\nexport { where };\n"
    const chunk = write('dep/index.esm.js', source)
    shimCjsGlobalsPass(depsRoot)
    expect(readFileSync(chunk, 'utf8')).toBe(source)
  })

  it('counts every chunk it shims', () => {
    write('a/index.esm.js', 'const v = __dirname;\nexport { v };\n')
    write('b/index.esm.js', 'const v = __filename;\nexport { v };\n')
    write('c/index.esm.js', 'const v = 1;\nexport { v };\n')
    expect(shimCjsGlobalsPass(depsRoot)).toEqual({ chunksShimmed: 2 })
  })
})
