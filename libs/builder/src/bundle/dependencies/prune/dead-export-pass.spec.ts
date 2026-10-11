import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { stripDeadExportsPass } from './dead-export-pass'

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

describe('stripDeadExportsPass', () => {
  let outputPath: string
  let depsRoot: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-dead-export-pass-'))
    depsRoot = join(outputPath, '_dependencies')
    mkdirSync(depsRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  const write = (relPath: string, content: string): void => {
    const abs = join(outputPath, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }

  const read = (relPath: string): string => readFileSync(join(outputPath, relPath), 'utf-8')

  it('returns zero counts when there are no chunk files', () => {
    expect(stripDeadExportsPass(makeContext(outputPath), depsRoot)).toEqual({ deadExportsRemoved: 0, bytesRemoved: 0 })
  })

  it('reports the count of exports stripped from a surviving chunk', () => {
    write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    expect(stripDeadExportsPass(makeContext(outputPath), depsRoot).deadExportsRemoved).toBe(1)
  })

  it('removes the dead export from the chunk on disk', () => {
    write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/d/index.mjs')).not.toContain('unused')
  })

  it('propagates a newly-dead export across chunks over successive iterations', () => {
    write('index.mjs', "import { used } from './_dependencies/a/index.mjs'")
    write(
      '_dependencies/a/index.mjs',
      "import { needed, notNeeded } from '../b/index.mjs';\nconst used = needed;\nconst dead = notNeeded;\nexport { used, dead };"
    )
    write('_dependencies/b/index.mjs', 'const needed = 1;\nconst notNeeded = 2;\nexport { needed, notNeeded };')
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/b/index.mjs')).not.toContain('notNeeded')
  })

  it('strips a dead cjs export demanded by no requirer', () => {
    write('index.cjs', "var dep = require('./_dependencies/d/index.cjs');\ndep.getType;")
    write(
      '_dependencies/d/index.cjs',
      "'use strict';\nconst getType = 1;\nconst unused = 2;\nexports.getType = getType;\nexports.unused = unused;"
    )
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/d/index.cjs')).not.toContain('exports.unused')
  })

  it('leaves a chunk untouched when an importer consumes it wholesale', () => {
    write('index.mjs', "import * as everything from './_dependencies/d/index.mjs'")
    write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/d/index.mjs')).toContain('const b = 2;')
  })

  it('keeps every export when one importer demands all even though another names a subset', () => {
    write('index.mjs', "import * as everything from './_dependencies/d/index.mjs';\nimport { x } from './_dependencies/e/index.mjs'")
    write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    write('_dependencies/e/index.mjs', "import { a } from '../d/index.mjs';\nconst x = a;\nexport { x };")
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/d/index.mjs')).toContain('const b = 2;')
  })

  it('ignores importer edges that resolve outside the dependency chunk set', () => {
    write('index.mjs', "import { z } from './helper.esm.js';\nimport { keep } from './_dependencies/d/index.mjs'")
    write('helper.esm.js', 'export const z = 1;')
    write('_dependencies/d/index.mjs', 'const keep = 1;\nconst gone = 2;\nexport { keep, gone };')
    stripDeadExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/d/index.mjs')).not.toContain('gone')
  })

  it('makes no change when every export is demanded', () => {
    write('index.mjs', "import { a, b } from './_dependencies/d/index.mjs'")
    write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    expect(stripDeadExportsPass(makeContext(outputPath), depsRoot).deadExportsRemoved).toBe(0)
  })
})
