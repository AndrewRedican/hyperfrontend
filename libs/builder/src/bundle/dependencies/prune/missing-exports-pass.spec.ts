import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
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
  let outputPath: string
  let depsRoot: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-missing-exports-pass-'))
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

  it('returns a zero count when the deps root does not exist', () => {
    expect(synthesizeMissingExportsPass(makeContext(outputPath), join(outputPath, 'absent'))).toEqual({ namedExportsSynthesized: 0 })
  })

  it('returns a zero count when no chunk files exist', () => {
    expect(synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)).toEqual({ namedExportsSynthesized: 0 })
  })

  it('synthesizes a named export an entry demands from an interop wrapper', () => {
    write('_dependencies/postject/index.esm.js', WRAPPER)
    write('index.esm.js', "import { inject } from './_dependencies/postject/index.esm.js';\nexport const run = () => inject();\n")
    expect(synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)).toEqual({ namedExportsSynthesized: 1 })
  })

  it('appends the synthesized binding to the wrapper chunk', () => {
    write('_dependencies/postject/index.esm.js', WRAPPER)
    write('index.esm.js', "import { inject } from './_dependencies/postject/index.esm.js';\nexport const run = () => inject();\n")
    synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/postject/index.esm.js')).toContain('export { inject$1 as inject };')
  })

  it('collects demand from sibling dependency chunks as importers', () => {
    write('_dependencies/postject/index.esm.js', WRAPPER)
    write(
      '_dependencies/other/index.esm.js',
      "import { inject } from '../postject/index.esm.js';\nconst use = () => inject();\nexport { use };\n"
    )
    expect(synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)).toEqual({ namedExportsSynthesized: 1 })
  })

  it('treats wholesale namespace demand as needing no synthesis', () => {
    write('_dependencies/postject/index.esm.js', WRAPPER)
    write('index.esm.js', "import * as postject from './_dependencies/postject/index.esm.js';\nexport const run = () => postject;\n")
    expect(synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)).toEqual({ namedExportsSynthesized: 0 })
  })

  it('leaves a chunk untouched when its exports satisfy the demand', () => {
    write('_dependencies/tool/index.esm.js', 'const run = () => 1;\nexport { run };\n')
    write('index.esm.js', "import { run } from './_dependencies/tool/index.esm.js';\nexport const go = () => run();\n")
    synthesizeMissingExportsPass(makeContext(outputPath), depsRoot)
    expect(read('_dependencies/tool/index.esm.js')).toBe('const run = () => 1;\nexport { run };\n')
  })
})
