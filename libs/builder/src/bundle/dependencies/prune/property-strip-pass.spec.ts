import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { stripDeadPropertiesPass } from './property-strip-pass'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (outputPath: string): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery([ROOT_ENTRY]),
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

const NS_CHUNK =
  'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { freeze, keys, SafeObject };'

describe('stripDeadPropertiesPass', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-prop-strip-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  const write = (relPath: string, content = ''): void => {
    const abs = join(outputPath, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }

  const run = (): ReturnType<typeof stripDeadPropertiesPass> =>
    stripDeadPropertiesPass(makeContext(outputPath), join(outputPath, '_dependencies'))

  const chunkText = (): string => readFileSync(join(outputPath, '_dependencies/d/index.mjs'), 'utf8')

  it('returns zero counts when there is no _dependencies directory', () => {
    write('index.mjs', 'export const a = 1;')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when there are no ESM chunks', () => {
    write('index.mjs', 'export const a = 1;')
    write('_dependencies/keep.txt', 'x')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when no chunk exports a frozen namespace', () => {
    write('index.mjs', "import { x } from './_dependencies/d/index.mjs';\nexport const u = x;")
    write('_dependencies/d/index.mjs', 'const x = 1;\nexport { x };')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('reports the slot stripped off a wholesale-imported namespace and the bytes it freed', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run()).toEqual({ deadPropertiesRemoved: 1, bytesRemoved: Buffer.byteLength(', keys') })
  })

  it('strips the slots an entry never reads off a wholesale-imported namespace', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze })')
  })

  it('reports no dead property when a consumer reads every slot', () => {
    write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nexport const v = SafeObject.keys;"
    )
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps every slot a consumer reads', () => {
    write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nexport const v = SafeObject.keys;"
    )
    write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('keeps a namespace whole when a consumer spreads it', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const all = { ...SafeObject };")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a namespace whole when a consumer imports the chunk as a namespace', () => {
    write('index.mjs', "import * as ns from './_dependencies/d/index.mjs';\nexport const u = ns.SafeObject.freeze;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  const SELF_READING_CHUNK =
    'const freeze = 1;\nconst keys = 2;\nconst create = 3;\nconst SafeObject = Object.freeze({ freeze, keys, create });\nconst self = SafeObject.keys;\nexport { SafeObject, self };'

  it('reports only the slot neither the consumer nor the defining chunk reads', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    write('_dependencies/d/index.mjs', SELF_READING_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('honors the defining chunk own internal read when computing demand', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    write('_dependencies/d/index.mjs', SELF_READING_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze, keys })')
  })

  it('reports no dead property when a consumer only reads a property the namespace does not define', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.missing;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a namespace whole when a consumer only reads a property it does not define', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.missing;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('leaves a wholly-unread namespace import to the export pass', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = 1;")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('reports no dead property when a dynamic specifier appears anywhere in the graph', () => {
    write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nconst p = import('./x' + u);"
    )
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('bails the whole run on a dynamic specifier anywhere in the graph', () => {
    write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nconst p = import('./x' + u);"
    )
    write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('reports one dead property when demand arrives through a sibling dependency chunk', () => {
    write('index.mjs', "import { mid } from './_dependencies/a/index.mjs';\nexport const u = mid;")
    write('_dependencies/a/index.mjs', "import { SafeObject } from '../d/index.mjs';\nconst mid = SafeObject.freeze;\nexport { mid };")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('reads namespace demand across a sibling dependency chunk', () => {
    write('index.mjs', "import { mid } from './_dependencies/a/index.mjs';\nexport const u = mid;")
    write('_dependencies/a/index.mjs', "import { SafeObject } from '../d/index.mjs';\nconst mid = SafeObject.freeze;\nexport { mid };")
    write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze })')
  })

  const CJS_NS_CHUNK =
    'var freeze = 1;\nvar keys = 2;\nvar SafeObject = Object.freeze({ freeze, keys });\nexports.freeze = freeze;\nexports.keys = keys;\nexports.SafeObject = SafeObject;'
  const cjsChunkText = (): string => readFileSync(join(outputPath, '_dependencies/d/index.cjs'), 'utf8')

  it('reports one dead property for a slot read two-level off a CJS require namespace binding', () => {
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.freeze;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('strips a slot read two-level off a CJS require namespace binding', () => {
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.freeze;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toContain('Object.freeze({ freeze })')
  })

  it('reports no dead property when a CJS module binding is consumed wholesale', () => {
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.all = d.SafeObject;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a CJS namespace whole when the module binding is consumed wholesale', () => {
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.all = d.SafeObject;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toBe(CJS_NS_CHUNK)
  })

  it('reports one dead property for a CJS namespace read through a destructured require binding', () => {
    write('index.cjs', "var { SafeObject } = require('./_dependencies/d/index.cjs');\nexports.u = SafeObject.keys;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('strips a CJS namespace read through a destructured require binding', () => {
    write('index.cjs', "var { SafeObject } = require('./_dependencies/d/index.cjs');\nexports.u = SafeObject.keys;")
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toContain('Object.freeze({ keys })')
  })

  it('counts the slots stripped from ESM and CJS chunks in the same run', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/e/index.mjs';\nexport const u = SafeObject.freeze;")
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.keys;")
    write('_dependencies/e/index.mjs', NS_CHUNK)
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(2)
  })

  it('processes ESM and CJS chunks in the same run', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/e/index.mjs';\nexport const u = SafeObject.freeze;")
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.keys;")
    write('_dependencies/e/index.mjs', NS_CHUNK)
    write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect([cjsChunkText(), readFileSync(join(outputPath, '_dependencies/e/index.mjs'), 'utf8')]).toEqual([
      expect.stringContaining('Object.freeze({ keys })'),
      expect.stringContaining('Object.freeze({ freeze })'),
    ])
  })
})
