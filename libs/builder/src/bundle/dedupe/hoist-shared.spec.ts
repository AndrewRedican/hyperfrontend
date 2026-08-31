import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { hoistSharedFirstParty } from './hoist-shared'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/p/src/index.ts', isRoot: true }
const GREET_ENTRY: EntryPoint = { exportPath: './greet', srcPath: 'greet', inputFile: '/p/src/greet/index.ts', isRoot: false }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'feature',
  entryPoints: entries,
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
})

describe('hoistSharedFirstParty', () => {
  let root: string
  let projectRoot: string
  let outputPath: string

  const write = (relPath: string, content: string): void => {
    const abs = join(outputPath, relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  const writeSrc = (relPath: string, content: string): void => {
    const abs = join(projectRoot, 'src', relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  const context = (entries: EntryPoint[] = [ROOT_ENTRY, GREET_ENTRY]): BuildContext => ({
    projectRoot,
    workspaceRoot: root,
    projectRelativePath: 'project',
    outputPath,
    tsConfigPath: join(projectRoot, 'tsconfig.lib.json'),
    external: [],
    assets: [],
    isWorkspacePackage: () => false,
    entryPointDiscovery: makeDiscovery(entries),
    bundledDeps: [],
    workspaceBundledDeps: [],
    startedAt: 0,
  })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-dedupe-'))
    projectRoot = join(root, 'project')
    outputPath = join(root, 'out')
    mkdirSync(projectRoot, { recursive: true })
    mkdirSync(outputPath, { recursive: true })
    writeSrc('base/base.ts', "export const BASE = 'b'\n")
    writeSrc('greet/greet.ts', "export const greet = (): string => 'x'\n")
    write('_dependencies/dep/index.esm.js', "const tag = (s) => '[' + s + ']';\nexport { tag };\n")
    write('_dependencies/dep/index.cjs.js', "'use strict';\nconst tag = (s) => '[' + s + ']';\nexports.tag = tag;\n")
    write(
      'index.esm.js',
      "import { tag } from './_dependencies/dep/index.esm.js';\nconst BASE = 'b';\nconst greet = (n) => tag(BASE + n);\nexport { BASE, greet };\n"
    )
    write(
      'index.cjs.js',
      "'use strict';\nvar dep = require('./_dependencies/dep/index.cjs.js');\nconst BASE = 'b';\nconst greet = (n) => dep.tag(BASE + n);\nexports.BASE = BASE;\nexports.greet = greet;\n"
    )
    write(
      'greet/index.esm.js',
      "import { tag } from '../_dependencies/dep/index.esm.js';\nconst BASE = 'b';\nconst greet = (n) => tag(BASE + n);\nexport { greet };\n"
    )
    write(
      'greet/index.cjs.js',
      "'use strict';\nvar dep = require('../_dependencies/dep/index.cjs.js');\nconst BASE = 'b';\nconst greet = (n) => dep.tag(BASE + n);\nexports.greet = greet;\n"
    )
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes a shared chunk for every hotspot module per format', () => {
    hoistSharedFirstParty(context())
    expect(
      [
        '_shared/base/base/index.esm.js',
        '_shared/base/base/index.cjs.js',
        '_shared/greet/greet/index.esm.js',
        '_shared/greet/greet/index.cjs.js',
      ].map((relPath) => existsSync(join(outputPath, relPath)))
    ).toEqual([true, true, true, true])
  })

  it('reports the chunks written and net bytes reclaimed', () => {
    expect(hoistSharedFirstParty(context())).toEqual({ chunksWritten: 4, bytesReclaimed: expect.any(Number) })
  })

  it('splices the hoisted declaration out of the consuming entry', () => {
    hoistSharedFirstParty(context())
    expect(readFileSync(join(outputPath, 'index.esm.js'), 'utf8')).not.toContain('const greet =')
  })

  it('imports the hoisted module into the consuming entry', () => {
    hoistSharedFirstParty(context())
    expect(readFileSync(join(outputPath, 'index.esm.js'), 'utf8')).toContain("from './_shared/greet/greet/index.esm.js'")
  })

  it('resolves the cross-module reference from inside the shared chunk', () => {
    hoistSharedFirstParty(context())
    expect(readFileSync(join(outputPath, '_shared/greet/greet/index.esm.js'), 'utf8')).toContain("from '../../base/base/index.esm.js'")
  })

  it('keeps the published export surface intact', () => {
    hoistSharedFirstParty(context())
    expect(readFileSync(join(outputPath, 'index.esm.js'), 'utf8')).toContain('export { BASE, greet };')
  })

  it('produces a CJS root entry that still computes through the shared chunks', () => {
    hoistSharedFirstParty(context())
    const out = execFileSync('node', [
      '-e',
      `const m = require(${JSON.stringify(join(outputPath, 'index.cjs.js'))}); process.stdout.write(m.greet('y') + ':' + m.BASE)`,
    ])
    expect(out.toString()).toBe('[by]:b')
  })

  it('produces an ESM root entry that still computes through the shared chunks', () => {
    hoistSharedFirstParty(context())
    write('package.json', '{ "type": "module" }')
    const url = `file://${join(outputPath, 'index.esm.js')}`
    const out = execFileSync('node', [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(url)}); process.stdout.write(m.greet('y') + ':' + m.BASE)`,
    ])
    expect(out.toString()).toBe('[by]:b')
  })

  it('captures a memory checkpoint per format', () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof hoistSharedFirstParty>[1]
    hoistSharedFirstParty(context(), monitor)
    expect(labels).toEqual(['bundle:dedupe:shared-first-party:esm:end', 'bundle:dedupe:shared-first-party:cjs:end'])
  })

  it('does nothing when fewer than two entries exist', () => {
    hoistSharedFirstParty(context([ROOT_ENTRY]))
    expect(existsSync(join(outputPath, '_shared'))).toBe(false)
  })

  it('returns an empty report when the source tree is absent', () => {
    rmSync(join(projectRoot, 'src'), { recursive: true, force: true })
    expect(hoistSharedFirstParty(context())).toEqual({ chunksWritten: 0, bytesReclaimed: 0 })
  })

  describe('with an external dependency and a non-sharing entry', () => {
    const SOLO: EntryPoint = { exportPath: './solo', srcPath: 'solo', inputFile: '/p/src/solo/index.ts', isRoot: false }

    beforeEach(() => {
      writeSrc('solo/solo.ts', "export const solo = (): string => 's'\n")
      // why: greet now pulls a bare, node-builtin specifier so the chunk's dependency edge passes through verbatim instead of being recomputed.
      write(
        'index.esm.js',
        "import { sep } from 'node:path';\nconst BASE = 'b';\nconst greet = (n) => sep + BASE + n;\nexport { BASE, greet };\n"
      )
      write(
        'greet/index.esm.js',
        "import { sep } from 'node:path';\nconst BASE = 'b';\nconst greet = (n) => sep + BASE + n;\nexport { greet };\n"
      )
      write('solo/index.esm.js', "const solo = () => 's';\nexport { solo };\n")
    })

    it('passes a bare dependency specifier through to the shared chunk unchanged', () => {
      hoistSharedFirstParty(context([ROOT_ENTRY, GREET_ENTRY, SOLO]))
      expect(readFileSync(join(outputPath, '_shared/greet/greet/index.esm.js'), 'utf8')).toContain("import { sep } from 'node:path';")
    })

    it('leaves an entry with no hoistable module untouched', () => {
      hoistSharedFirstParty(context([ROOT_ENTRY, GREET_ENTRY, SOLO]))
      expect(readFileSync(join(outputPath, 'solo/index.esm.js'), 'utf8')).toBe("const solo = () => 's';\nexport { solo };\n")
    })
  })

  describe('with a CJS dep-namespace $N divergence across entries', () => {
    // why: rollup numbers CJS dep-namespace locals per-entry (dep_cjs_js$1 vs $2), so two copies of
    beforeEach(() => {
      writeSrc('util/util.ts', 'export const util = (n) => n\n')
      write('index.esm.js', "import { tag } from './_dependencies/dep/index.esm.js';\nconst util = (n) => tag(n);\nexport { util };\n")
      write(
        'greet/index.esm.js',
        "import { tag } from '../_dependencies/dep/index.esm.js';\nconst util = (n) => tag(n);\nexport { util };\n"
      )
      write(
        'index.cjs.js',
        "'use strict';\nvar dep_cjs_js$2 = require('./_dependencies/dep/index.cjs.js');\nconst util = (n) => dep_cjs_js$2.tag(n);\nexports.util = util;\n"
      )
      write(
        'greet/index.cjs.js',
        "'use strict';\nvar dep_cjs_js$1 = require('../_dependencies/dep/index.cjs.js');\nconst util = (n) => dep_cjs_js$1.tag(n);\nexports.util = util;\n"
      )
    })

    it('hoists the module symmetrically in both formats despite the rename divergence', () => {
      hoistSharedFirstParty(context())
      expect(
        ['_shared/util/util/index.esm.js', '_shared/util/util/index.cjs.js'].map((relPath) => existsSync(join(outputPath, relPath)))
      ).toEqual([true, true])
    })

    it('produces a CJS root entry that loads through the shared chunk', () => {
      hoistSharedFirstParty(context())
      const out = execFileSync('node', [
        '-e',
        `const m = require(${JSON.stringify(join(outputPath, 'index.cjs.js'))}); process.stdout.write(m.util('y'))`,
      ])
      expect(out.toString()).toBe('[y]')
    })

    it('produces an ESM root entry that loads through the shared chunk', () => {
      hoistSharedFirstParty(context())
      write('package.json', '{ "type": "module" }')
      const url = `file://${join(outputPath, 'index.esm.js')}`
      const out = execFileSync('node', [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(url)}); process.stdout.write(m.util('y'))`,
      ])
      expect(out.toString()).toBe('[y]')
    })
  })

  describe('with a first-party dependency cycle', () => {
    // why: shared chunks load topologically; modules in a cycle cannot be ordered safely, so they are
    const cyclic = (header: string, exportsTail: string): string =>
      `${header}const cycA = () => cycB;\nconst cycB = () => cycA;\nconst freeVal = 41;\n${exportsTail}`

    beforeEach(() => {
      writeSrc('cyc-a/cyc-a.ts', 'export const cycA = () => cycB\n')
      writeSrc('cyc-b/cyc-b.ts', 'export const cycB = () => cycA\n')
      writeSrc('free/free.ts', 'export const freeVal = 41\n')
      write('index.esm.js', cyclic('', 'export { cycA, freeVal };\n'))
      write('greet/index.esm.js', cyclic('', 'export { freeVal };\n'))
      write('index.cjs.js', cyclic("'use strict';\n", 'exports.cycA = cycA;\nexports.freeVal = freeVal;\n'))
      write('greet/index.cjs.js', cyclic("'use strict';\n", 'exports.freeVal = freeVal;\n'))
    })

    it('hoists the acyclic module but leaves the cyclic modules inlined', () => {
      hoistSharedFirstParty(context())
      expect([
        existsSync(join(outputPath, '_shared/free/free/index.esm.js')),
        existsSync(join(outputPath, '_shared/cyc-a/cyc-a/index.esm.js')),
        existsSync(join(outputPath, '_shared/cyc-b/cyc-b/index.esm.js')),
      ]).toEqual([true, false, false])
    })

    it('keeps the cyclic declarations inlined in the rewritten entry', () => {
      hoistSharedFirstParty(context())
      expect(readFileSync(join(outputPath, 'index.esm.js'), 'utf8')).toContain('const cycA = () => cycB;')
    })

    it('produces a CJS root entry that loads through the partial hoist', () => {
      hoistSharedFirstParty(context())
      const out = execFileSync('node', [
        '-e',
        `const m = require(${JSON.stringify(join(outputPath, 'index.cjs.js'))}); process.stdout.write(m.freeVal + ':' + typeof m.cycA)`,
      ])
      expect(out.toString()).toBe('41:function')
    })

    it('produces an ESM root entry that loads through the partial hoist', () => {
      hoistSharedFirstParty(context())
      write('package.json', '{ "type": "module" }')
      const url = `file://${join(outputPath, 'index.esm.js')}`
      const out = execFileSync('node', [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(url)}); process.stdout.write(m.freeVal + ':' + typeof m.cycA)`,
      ])
      expect(out.toString()).toBe('41:function')
    })
  })
})
