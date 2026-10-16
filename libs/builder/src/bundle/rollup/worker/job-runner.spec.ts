import type { RollupBuildDescriptor } from './types'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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

  it('reports a positive output size, positive memory figures and a non-negative duration for an ESM descriptor', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 42\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const report = await runRollupWorkerJob(
      baseDescriptor({ format: 'esm', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath })
    )
    expect({
      outputSize: report.outputSize > 0,
      endHeapMB: report.endHeapMB > 0,
      endRssMB: report.endRssMB > 0,
      durationMs: report.durationMs >= 0,
    }).toEqual({ outputSize: true, endHeapMB: true, endRssMB: true, durationMs: true })
  })

  it('persists the returned report as JSON at reportPath', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 42\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    const report = await runRollupWorkerJob(
      baseDescriptor({ format: 'esm', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath })
    )
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toEqual(report)
  })

  it('writes an ESM bundle under outputDir when given an ESM descriptor', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 42\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(baseDescriptor({ format: 'esm', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath }))
    expect(readFileSync(join(outputDir, 'index.mjs'), 'utf8')).toContain('42')
  })

  it('writes a CJS bundle when format is cjs', async () => {
    const inputFile = writeSrc('input.ts', 'export const value = 7\n')
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const reportPath = join(root, 'report.json')
    await runRollupWorkerJob(baseDescriptor({ format: 'cjs', inputFile, outputDir, sourcemap: false, tsConfigPath, reportPath }))
    const contents = readFileSync(join(outputDir, 'index.cjs'), 'utf8')
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
    const contents = readFileSync(join(outputDir, 'index.mjs'), 'utf8')
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
    expect(readFileSync(join(outputDir, 'index.mjs'), 'utf8')).toMatch(/from\s+["']@other\/pkg["']/)
  })

  it('still bundles an entry whose workspace import cannot resolve without path mappings', async () => {
    const inputFile = writeSrc(
      'input.ts',
      "import { isArray } from '@other/pkg'\nexport const joined = (value: unknown): string => (isArray(value) ? value.join(',') : '')\n"
    )
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await runRollupWorkerJob(baseDescriptor({ format: 'esm', inputFile, outputDir, tsConfigPath, reportPath: join(root, 'report.json') }))
    } finally {
      warn.mockRestore()
    }
    expect(readFileSync(join(outputDir, 'index.mjs'), 'utf8')).toContain('isArray(value)')
  })

  it('drops type diagnostics computed without path mappings, where a workspace import cannot resolve', async () => {
    const inputFile = writeSrc(
      'input.ts',
      "import { isArray } from '@other/pkg'\nexport const joined = (value: unknown): string => (isArray(value) ? value.join(',') : '')\n"
    )
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await runRollupWorkerJob(baseDescriptor({ format: 'esm', inputFile, outputDir, tsConfigPath, reportPath: join(root, 'report.json') }))
    } finally {
      warn.mockRestore()
    }
    expect(warn.mock.calls.flat().filter((entry) => /TS\d{4,5}/.test(String(entry)))).toEqual([])
  })

  it('keeps type diagnostics when the typescript plugin resolves workspace imports itself', async () => {
    const inputFile = writeSrc('input.ts', "export const count: number = 'one'\n")
    const tsConfigPath = writeTsconfig()
    const outputDir = join(root, 'out')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
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
    } finally {
      warn.mockRestore()
    }
    expect(warn.mock.calls.flat().some((entry) => /TS2322/.test(String(entry)))).toBe(true)
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
    const contents = readFileSync(join(outputDir, 'index.mjs'), 'utf8')
    expect(contents).toMatch(/_dependencies\/rollup\/index\.mjs/)
  })

  it('emits a runnable CJS bundle when an externalized dep uses pre-pass named-form exports (default + named with __esModule)', async () => {
    const depsRoot = join(root, '_dependencies')
    const depDir = join(depsRoot, 'fake-dep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(
      join(depDir, 'index.cjs'),
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
    expect(createRequire(import.meta.url)(join(outputDir, 'index.cjs'))).toBe(42)
  })

  it('emits const (not var) require bindings for externalized deps in CJS output', async () => {
    const depsRoot = join(root, '_dependencies')
    const depDir = join(depsRoot, 'fake-dep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(join(depDir, 'index.cjs'), ["'use strict';", 'function fakeDep() { return 5 }', 'exports.fakeDep = fakeDep;'].join('\n'))
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
    // why: the lookahead lists only the declaration keyword of every require binding, so a lone `const` proves the single binding is const and no `var` form slipped in.
    expect(readFileSync(join(outputDir, 'index.cjs'), 'utf8').match(/^(?:const|var)(?= \w+ = require\()/gm)).toEqual(['const'])
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
    expect(readFileSync(join(outputDir, 'index.mjs'), 'utf8')).toContain('41')
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
    expect({ files: readdirSync(outputDir), unminified: readFileSync(join(outputDir, 'index.iife.js'), 'utf8') }).toEqual({
      files: ['index.iife.js'],
      unminified: expect.stringContaining('MyLib'),
    })
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
    expect({
      unminified: readFileSync(join(outputDir, 'index.iife.js'), 'utf8'),
      minified: readFileSync(join(outputDir, 'index.iife.min.js'), 'utf8'),
    }).toEqual({
      unminified: expect.stringContaining('MyLib'),
      minified: expect.stringContaining('MyLib'),
    })
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
    expect({
      unminified: readFileSync(join(outputDir, 'index.umd.js'), 'utf8'),
      minified: readFileSync(join(outputDir, 'index.umd.min.js'), 'utf8'),
    }).toEqual({
      unminified: expect.stringMatching(/define\('mylib'[\s\S]*global\.MyLib/),
      minified: expect.stringContaining('MyLib'),
    })
  })

  it('writes a bin CJS bundle to bin.outputFile wrapped in the shebang banner and the bootstrap footer', async () => {
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
    expect(readFileSync(outputFile, 'utf8')).toMatch(/^#!\/usr\/bin\/env node\n[\s\S]*\/\/ bootstrap-footer\n$/)
  })

  it('marks the bin CJS bundle executable', async () => {
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
    // why: Windows has no execute bit, so chmod leaves the file at its writable default.
    expect(statSync(outputFile).mode & 0o777).toBe(process.platform === 'win32' ? 0o666 : 0o755)
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
    expect(readFileSync(outputFile, 'utf8')).toMatch(/^#!\/usr\/bin\/env node\n[\s\S]*\/\/ esm-bootstrap\n$/)
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
    const contents = readFileSync(join(outputDir, 'index.mjs'), 'utf8')
    expect(contents).toMatch(/_dependencies\/@hyperfrontend\/logging\/index\.mjs/)
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
    const contents = readFileSync(join(outputDir, 'index.mjs'), 'utf8')
    expect(contents).toMatch(/_dependencies\/@hyperfrontend\/immutable-api-utils\/built-in-copy\/date\/index\.mjs/)
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
