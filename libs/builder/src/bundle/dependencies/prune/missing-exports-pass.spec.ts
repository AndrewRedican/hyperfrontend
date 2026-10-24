import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { mkdirSync } from 'node:fs'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { synthesizeMissingExportsPass } from './missing-exports-pass'

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

const WRAPPER = [
  'function requireApi() {',
  '  return { inject: () => 1 };',
  '}',
  'var apiExports = requireApi();',
  'const api = /*@__PURE__*/getDefaultExportFromCjs(apiExports);',
  'export { api as default };',
  '',
].join('\n')

describe('synthesizeMissingExportsPass', () => {
  const outputDir = useTempDir({ prefix: 'builder-missing-exports-pass-' })
  let depsRoot: string

  beforeEach(() => {
    depsRoot = outputDir.resolve('_dependencies')
    mkdirSync(depsRoot, { recursive: true })
  })

  it('returns a zero count when the deps root does not exist', () => {
    expect(synthesizeMissingExportsPass(makeContext(outputDir.path), outputDir.resolve('absent'))).toEqual({ namedExportsSynthesized: 0 })
  })

  it('returns a zero count when no chunk files exist', () => {
    expect(synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)).toEqual({ namedExportsSynthesized: 0 })
  })

  it('synthesizes a named export an entry demands from an interop wrapper', () => {
    outputDir.write('_dependencies/postject/index.mjs', WRAPPER)
    outputDir.write('index.mjs', "import { inject } from './_dependencies/postject/index.mjs';\nexport const run = () => inject();\n")
    expect(synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)).toEqual({ namedExportsSynthesized: 1 })
  })

  it('appends the synthesized binding to the wrapper chunk', () => {
    outputDir.write('_dependencies/postject/index.mjs', WRAPPER)
    outputDir.write('index.mjs', "import { inject } from './_dependencies/postject/index.mjs';\nexport const run = () => inject();\n")
    synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/postject/index.mjs')).toContain('export { inject$1 as inject };')
  })

  it('collects demand from sibling dependency chunks as importers', () => {
    outputDir.write('_dependencies/postject/index.mjs', WRAPPER)
    outputDir.write(
      '_dependencies/other/index.mjs',
      "import { inject } from '../postject/index.mjs';\nconst use = () => inject();\nexport { use };\n"
    )
    expect(synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)).toEqual({ namedExportsSynthesized: 1 })
  })

  it('treats wholesale namespace demand as needing no synthesis', () => {
    outputDir.write('_dependencies/postject/index.mjs', WRAPPER)
    outputDir.write('index.mjs', "import * as postject from './_dependencies/postject/index.mjs';\nexport const run = () => postject;\n")
    expect(synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)).toEqual({ namedExportsSynthesized: 0 })
  })

  it('leaves a chunk untouched when its exports satisfy the demand', () => {
    outputDir.write('_dependencies/tool/index.mjs', 'const run = () => 1;\nexport { run };\n')
    outputDir.write('index.mjs', "import { run } from './_dependencies/tool/index.mjs';\nexport const go = () => run();\n")
    synthesizeMissingExportsPass(makeContext(outputDir.path), depsRoot)
    expect(outputDir.read('_dependencies/tool/index.mjs')).toBe('const run = () => 1;\nexport { run };\n')
  })
})
