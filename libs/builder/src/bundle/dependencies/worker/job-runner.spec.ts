import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runPrePassWorkerJob } from './job-runner'

describe('runPrePassWorkerJob', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-worker-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const writeSrc = (relative: string, contents: string): string => {
    const path = join(root, relative)
    writeFileSync(path, contents)
    return path
  }

  it('writes an ESM bundle and a JSON report when given a JS job', async () => {
    const inputPath = writeSrc('input.mjs', 'export const value = 42\n')
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    const report = await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath,
      otherDeps: [],
      reportPath,
    })
    expect(report.outputSize).toBeGreaterThan(0)
    expect(report.peakHeapMB).toBeGreaterThan(0)
    expect(report.peakRssMB).toBeGreaterThan(0)
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
    const persisted = JSON.parse(readFileSync(reportPath, 'utf8'))
    expect(persisted.outputSize).toBe(report.outputSize)
    expect(readFileSync(outputPath, 'utf8')).toContain('42')
  })

  it('writes a CJS bundle when format is "cjs"', async () => {
    const inputPath = writeSrc('input.mjs', 'export const value = 7\n')
    const outputPath = join(root, 'out.cjs.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'cjs',
      outputPath,
      otherDeps: [],
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toContain("'use strict'")
  })

  it('marks otherDeps as external in the rollup config', async () => {
    const inputPath = writeSrc('input.mjs', "import other from 'other-dep'\nexport default other\n")
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath,
      otherDeps: ['other-dep'],
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']other-dep["']/)
  })

  it('marks subpath imports of otherDeps as external', async () => {
    const inputPath = writeSrc('input.mjs', "import other from 'other-dep/sub'\nexport default other\n")
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: ['other-dep'],
      outputPath,
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']other-dep\/sub["']/)
  })

  it('marks node:* and node builtins as external', async () => {
    const inputPath = writeSrc(
      'input.mjs',
      "import { join } from 'node:path'\nimport os from 'os'\nexport default join('a', os.tmpdir())\n"
    )
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']node:path["']/)
    expect(contents).toMatch(/from\s+["']os["']/)
  })

  it('suppresses circular-dependency warnings while still completing the bundle', async () => {
    writeSrc('a.mjs', "import './b.mjs'\nexport const a = 1\n")
    writeSrc('b.mjs', "import './a.mjs'\nexport const b = 2\n")
    const inputPath = writeSrc('input.mjs', "export * from './a.mjs'\nexport * from './b.mjs'\n")
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    const report = await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    expect(report.outputSize).toBeGreaterThan(0)
  })

  it('externalizes "typescript" from the JS pre-pass even when not in otherDeps', async () => {
    const inputPath = writeSrc('input.mjs', "import ts from 'typescript'\nexport default ts\n")
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']typescript["']/)
  })

  it('externalizes "typescript/lib/foo" subpath imports from the JS pre-pass', async () => {
    const inputPath = writeSrc('input.mjs', "import ts from 'typescript/lib/typescript'\nexport default ts\n")
    const outputPath = join(root, 'out.cjs.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'cjs',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/require\(["']typescript\/lib\/typescript["']\)/)
  })

  it('runs a dts job and writes a .d.ts output', async () => {
    const inputPath = writeSrc('types.d.ts', 'export interface Hello { value: number }\n')
    const outputPath = join(root, 'out.d.ts')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'dts',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toContain('Hello')
    expect(contents).toContain('value')
  })
})
