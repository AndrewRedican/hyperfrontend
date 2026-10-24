import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { mkdirSync } from 'node:fs'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
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
  const outputDir = useTempDir({ prefix: 'builder-dead-export-pass-' })
  let depsRoot: string

  beforeEach(() => {
    depsRoot = outputDir.resolve('_dependencies')
    mkdirSync(depsRoot, { recursive: true })
  })

  it('returns zero counts when there are no chunk files', () => {
    expect(stripDeadExportsPass(makeContext(outputDir.path), depsRoot)).toEqual({ deadExportsRemoved: 0, bytesRemoved: 0 })
  })

  it('reports the count of exports stripped from a surviving chunk', () => {
    outputDir.write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    outputDir.write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    expect(stripDeadExportsPass(makeContext(outputDir.path), depsRoot).deadExportsRemoved).toBe(1)
  })

  it('removes the dead export from the chunk on disk', () => {
    outputDir.write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    outputDir.write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/d/index.mjs')).not.toContain('unused')
  })

  it('propagates a newly-dead export across chunks over successive iterations', () => {
    outputDir.write('index.mjs', "import { used } from './_dependencies/a/index.mjs'")
    outputDir.write(
      '_dependencies/a/index.mjs',
      "import { needed, notNeeded } from '../b/index.mjs';\nconst used = needed;\nconst dead = notNeeded;\nexport { used, dead };"
    )
    outputDir.write('_dependencies/b/index.mjs', 'const needed = 1;\nconst notNeeded = 2;\nexport { needed, notNeeded };')
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/b/index.mjs')).not.toContain('notNeeded')
  })

  it('strips a dead cjs export demanded by no requirer', () => {
    outputDir.write('index.cjs', "var dep = require('./_dependencies/d/index.cjs');\ndep.getType;")
    outputDir.write(
      '_dependencies/d/index.cjs',
      "'use strict';\nconst getType = 1;\nconst unused = 2;\nexports.getType = getType;\nexports.unused = unused;"
    )
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/d/index.cjs')).not.toContain('exports.unused')
  })

  it('leaves a chunk untouched when an importer consumes it wholesale', () => {
    outputDir.write('index.mjs', "import * as everything from './_dependencies/d/index.mjs'")
    outputDir.write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/d/index.mjs')).toContain('const b = 2;')
  })

  it('keeps every export when one importer demands all even though another names a subset', () => {
    outputDir.write(
      'index.mjs',
      "import * as everything from './_dependencies/d/index.mjs';\nimport { x } from './_dependencies/e/index.mjs'"
    )
    outputDir.write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    outputDir.write('_dependencies/e/index.mjs', "import { a } from '../d/index.mjs';\nconst x = a;\nexport { x };")
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/d/index.mjs')).toContain('const b = 2;')
  })

  it('ignores importer edges that resolve outside the dependency chunk set', () => {
    outputDir.write('index.mjs', "import { z } from './helper.esm.js';\nimport { keep } from './_dependencies/d/index.mjs'")
    outputDir.write('helper.esm.js', 'export const z = 1;')
    outputDir.write('_dependencies/d/index.mjs', 'const keep = 1;\nconst gone = 2;\nexport { keep, gone };')
    stripDeadExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/d/index.mjs')).not.toContain('gone')
  })

  it('makes no change when every export is demanded', () => {
    outputDir.write('index.mjs', "import { a, b } from './_dependencies/d/index.mjs'")
    outputDir.write('_dependencies/d/index.mjs', 'const a = 1;\nconst b = 2;\nexport { a, b };')
    expect(stripDeadExportsPass(makeContext(outputDir.path), depsRoot).deadExportsRemoved).toBe(0)
  })
})
