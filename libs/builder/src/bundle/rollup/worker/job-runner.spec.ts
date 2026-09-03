import type { RollupBuildDescriptor } from './types'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { runRollupWorkerJob } from './job-runner'

describe('runRollupWorkerJob', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-rollup-worker-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const writeSrc = (relative: string, contents: string): string => {
    const path = join(root, relative)
    writeFileSync(path, contents)
    return path
  }

  const writeTsconfig = (): string => {
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          esModuleInterop: true,
          allowJs: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
      })
    )
    return tsConfigPath
  }

  const baseDescriptor = (overrides: Partial<RollupBuildDescriptor>): RollupBuildDescriptor => ({
    format: 'esm',
    inputFile: '',
    outputDir: '',
    external: [],
    sourcemap: false,
    bundledDepsPlugin: null,
    workspaceRoutes: [],
    tsConfigPath: '',
    projectRoot: root,
    workspaceRoot: root,
    bundleWorkspaceDeps: false,
    bundle: null,
    bin: null,
    reportPath: '',
    ...overrides,
  })

  it('writes an ESM bundle and a JSON report when given an ESM descriptor', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 42\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const report = await runRollupWorkerJob(
      baseDescriptor({ format: 'esm', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath })
    )
    expect(report.outputSize).toBeGreaterThan(0)
    expect(report.endHeapMB).toBeGreaterThan(0)
    expect(report.endRssMB).toBeGreaterThan(0)
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
    const persisted = JSON.parse(readFileSync(reportPath, 'utf8'))
    expect(persisted.outputSize).toBe(report.outputSize)
    expect(readFileSync(join(outputDir, 'index.esm.js'), 'utf8')).toContain('42')
  })

  it('writes a CJS bundle when format is cjs', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 7\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(baseDescriptor({ format: 'cjs', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath }))
    const contents = readFileSync(join(outputDir, 'index.cjs.js'), 'utf8')
    expect(contents).toContain("'use strict'")
  })

  it('marks externals as external in the rollup config', async () => {
    const inputFile = writeSrc('input.ts', "import other from 'other-dep'\nexport default other\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        external: ['other-dep'],
      })
    )
    const contents = readFileSync(join(outputDir, 'index.esm.js'), 'utf8')
    expect(contents).toMatch(/from\s+["']other-dep["']/)
  })

  it('throws when a workspace-routed package import escapes routing in an entry build', async () => {
    const inputFile = writeSrc('input.ts', "import x from '@scope/pkg'\nexport default x\n")
    const tsConfigPath = writeTsconfig()
    await expect(
      runRollupWorkerJob(
        baseDescriptor({
          format: 'esm',
          inputFile,
          outputDir: join(root, 'out'),
          tsConfigPath,
          reportPath: join(root, 'report.json'),
          workspaceRoutes: [{ packageName: '@scope/pkg', policy: 'whole-surface' }],
        })
      )
    ).rejects.toThrow(/was not routed into _dependencies\//)
  })

  it('throws when a sub-path import of a workspace-routed package escapes routing', async () => {
    const inputFile = writeSrc('input.ts', "import x from '@scope/pkg/sub'\nexport default x\n")
    const tsConfigPath = writeTsconfig()
    await expect(
      runRollupWorkerJob(
        baseDescriptor({
          format: 'esm',
          inputFile,
          outputDir: join(root, 'out'),
          tsConfigPath,
          reportPath: join(root, 'report.json'),
          workspaceRoutes: [{ packageName: '@scope/pkg', policy: 'whole-surface' }],
        })
      )
    ).rejects.toThrow(/"@scope\/pkg\/sub"/)
  })

  it('lets a non-routed unresolved import externalize without throwing', async () => {
    const inputFile = writeSrc('input.ts', "import x from '@other/pkg'\nexport default x\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        tsConfigPath,
        reportPath: join(root, 'report.json'),
        workspaceRoutes: [{ packageName: '@scope/pkg', policy: 'whole-surface' }],
      })
    )
    expect(readFileSync(join(outputDir, 'index.esm.js'), 'utf8')).toMatch(/from\s+["']@other\/pkg["']/)
  })

  it('routes bundled-dep imports through the externalize plugin when configured', async () => {
    const inputFile = writeSrc('input.ts', "import x from 'rollup'\nexport default x\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const depsRoot = join(root, '_dependencies')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundledDepsPlugin: { deps: ['rollup'], depsRoot },
      })
    )
    const contents = readFileSync(join(outputDir, 'index.esm.js'), 'utf8')
    expect(contents).toMatch(/_dependencies\/rollup\/index\.esm\.js/)
  })

  it('emits a runnable CJS bundle when an externalized dep uses pre-pass named-form exports (default + named with __esModule)', async () => {
    const depsRoot = join(root, '_dependencies')
    const depDir = join(depsRoot, 'fake-dep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(
      join(depDir, 'index.cjs.js'),
      [
        "'use strict';",
        "Object.defineProperty(exports, '__esModule', { value: true });",
        'function fakeDep() { return 42 }',
        'exports.default = fakeDep;',
        'exports.fakeDep = fakeDep;',
      ].join('\n')
    )
    const inputFile = writeSrc('input.ts', "import x from 'fake-dep'\nmodule.exports = x()\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'cjs',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundledDepsPlugin: { deps: ['fake-dep'], depsRoot },
      })
    )
    expect(createRequire(import.meta.url)(join(outputDir, 'index.cjs.js'))).toBe(42)
  })

  it('emits const (not var) require bindings for externalized deps in CJS output', async () => {
    const depsRoot = join(root, '_dependencies')
    const depDir = join(depsRoot, 'fake-dep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(
      join(depDir, 'index.cjs.js'),
      ["'use strict';", 'function fakeDep() { return 5 }', 'exports.fakeDep = fakeDep;'].join('\n')
    )
    const inputFile = writeSrc('input.ts', "import { fakeDep } from 'fake-dep'\nexport const value = fakeDep()\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'cjs',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundledDepsPlugin: { deps: ['fake-dep'], depsRoot },
      })
    )
    const contents = readFileSync(join(outputDir, 'index.cjs.js'), 'utf8')
    expect(contents).toMatch(/const \w+ = require\(/)
    expect(contents).not.toMatch(/^var \w+ = require\(/m)
  })

  it('compiles TS-only syntax through the baseUrl branch when sources live outside the process cwd', async () => {
    writeSrc('types.ts', 'export interface Box { value: number }\n')
    const inputFile = writeSrc('input.ts', "import type { Box } from './types'\nexport const box: Box = { value: 41 }\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        tsConfigPath,
        reportPath: join(root, 'report.json'),
        bundleWorkspaceDeps: true,
      })
    )
    expect(readFileSync(join(outputDir, 'index.esm.js'), 'utf8')).toContain('41')
  })

  it('compiles TS-only syntax into an IIFE bundle when sources live outside the process cwd', async () => {
    writeSrc('types.ts', 'export interface Box { value: number }\n')
    const inputFile = writeSrc('input.ts', "import type { Box } from './types'\nexport const box: Box = { value: 43 }\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'iife-out')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'iife',
        inputFile,
        outputDir,
        tsConfigPath,
        reportPath: join(root, 'report.json'),
        bundle: { globalName: 'MyLib', minify: false },
      })
    )
    expect(readFileSync(join(outputDir, 'index.iife.js'), 'utf8')).toContain('43')
  })

  it('writes an unminified-only IIFE bundle when minify is disabled', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 1\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'iife-out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'iife',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundle: { globalName: 'MyLib', minify: false },
      })
    )
    const contents = readFileSync(join(outputDir, 'index.iife.js'), 'utf8')
    expect(contents).toContain('MyLib')
    expect(() => readFileSync(join(outputDir, 'index.iife.min.js'), 'utf8')).toThrow()
  })

  it('writes both unminified and minified IIFE bundles when minify is enabled', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 1\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'iife-out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'iife',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundle: { globalName: 'MyLib', minify: true },
      })
    )
    expect(readFileSync(join(outputDir, 'index.iife.js'), 'utf8')).toContain('MyLib')
    expect(readFileSync(join(outputDir, 'index.iife.min.js'), 'utf8')).toContain('MyLib')
  })

  it('writes a UMD bundle with amdId when supplied', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 1\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'umd-out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'umd',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundle: { globalName: 'MyLib', minify: true, amdId: 'mylib' },
      })
    )
    const contents = readFileSync(join(outputDir, 'index.umd.js'), 'utf8')
    expect(contents).toContain('MyLib')
    expect(contents).toContain('mylib')
    expect(readFileSync(join(outputDir, 'index.umd.min.js'), 'utf8')).toContain('MyLib')
  })

  it('writes a bin CJS bundle to bin.outputFile with shebang banner, footer, and chmod applied', async () => {
    const inputFile = writeSrc('hf-build.ts', 'export const runCz = async () => 0\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'bin-out')
    const outputFile = join(outputDir, 'hf-build.js')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'cjs',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundleWorkspaceDeps: true,
        bin: {
          outputFile,
          banner: '#!/usr/bin/env node',
          footer: '// bootstrap-footer',
          exports: 'named',
          inlineDynamicImports: true,
          chmod: 0o755,
        },
      })
    )
    const contents = readFileSync(outputFile, 'utf8')
    expect(contents.startsWith('#!/usr/bin/env node')).toBe(true)
    expect(contents).toContain('// bootstrap-footer')
    const mode = statSync(outputFile).mode & 0o777
    expect(mode).toBe(0o755)
  })

  it('writes a bin ESM bundle to bin.outputFile when format is esm', async () => {
    const inputFile = writeSrc('hf-build.ts', 'export default async () => 0\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'bin-out')
    const outputFile = join(outputDir, 'hf-build.mjs')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundleWorkspaceDeps: true,
        bin: {
          outputFile,
          banner: '#!/usr/bin/env node',
          footer: '// esm-bootstrap',
          exports: 'named',
          inlineDynamicImports: true,
          chmod: 0o755,
        },
      })
    )
    const contents = readFileSync(outputFile, 'utf8')
    expect(contents.startsWith('#!/usr/bin/env node')).toBe(true)
    expect(contents).toContain('// esm-bootstrap')
  })

  it('routes workspace-dep imports through _dependencies/<packageName>/ when workspaceRoutes is populated', async () => {
    const inputFile = writeSrc('input.ts', "import { logger } from '@hyperfrontend/logging'\nexport default logger\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const depsRoot = join(root, '_dependencies')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundledDepsPlugin: { deps: [], depsRoot },
        workspaceRoutes: [{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }],
      })
    )
    const contents = readFileSync(join(outputDir, 'index.esm.js'), 'utf8')
    expect(contents).toMatch(/_dependencies\/@hyperfrontend\/logging\/index\.esm\.js/)
  })

  it('routes sub-path workspace specifiers exactly when policy is sub-path', async () => {
    const inputFile = writeSrc(
      'input.ts',
      "import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'\nexport default dateNow\n"
    )
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const depsRoot = join(root, '_dependencies')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'esm',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundledDepsPlugin: { deps: [], depsRoot },
        workspaceRoutes: [
          {
            packageName: '@hyperfrontend/immutable-api-utils',
            policy: 'sub-path',
            specifiers: ['@hyperfrontend/immutable-api-utils/built-in-copy/date'],
          },
        ],
      })
    )
    const contents = readFileSync(join(outputDir, 'index.esm.js'), 'utf8')
    expect(contents).toMatch(/_dependencies\/@hyperfrontend\/immutable-api-utils\/built-in-copy\/date\/index\.esm\.js/)
  })

  it('writes only the unminified UMD output when minify is disabled', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 1\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'umd-out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(
      baseDescriptor({
        format: 'umd',
        inputFile,
        outputDir,
        sourcemap: false,
        tsConfigPath,
        reportPath,
        bundle: { globalName: 'MyLib', minify: false },
      })
    )
    expect(() => readFileSync(join(outputDir, 'index.umd.min.js'), 'utf8')).toThrow()
  })
})
