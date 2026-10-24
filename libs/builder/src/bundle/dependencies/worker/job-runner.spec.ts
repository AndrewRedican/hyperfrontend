import type { RollupLog } from 'rollup'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { onWarn, runPrePassWorkerJob } from './job-runner'

describe('runPrePassWorkerJob', () => {
  const dir = useTempDir({ prefix: 'builder-worker-' })

  it('reports a positive output size, positive memory figures and a non-negative duration for a JS job', async () => {
    const inputPath = dir.write('input.mjs', 'export const value = 42\n')
    const report = await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath: dir.resolve('out.esm.js'),
      otherDeps: [],
      reportPath: dir.resolve('report.json'),
    })
    expect({
      outputSize: report.outputSize > 0,
      endHeapMB: report.endHeapMB > 0,
      endRssMB: report.endRssMB > 0,
      durationMs: report.durationMs >= 0,
    }).toEqual({ outputSize: true, endHeapMB: true, endRssMB: true, durationMs: true })
  })

  it('persists the returned report as JSON at reportPath', async () => {
    const inputPath = dir.write('input.mjs', 'export const value = 42\n')
    const reportPath = dir.resolve('report.json')
    const report = await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath: dir.resolve('out.esm.js'),
      otherDeps: [],
      reportPath,
    })
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toEqual(report)
  })

  it('writes an ESM bundle at outputPath when given a JS job', async () => {
    const inputPath = dir.write('input.mjs', 'export const value = 42\n')
    const outputPath = dir.resolve('out.esm.js')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath,
      otherDeps: [],
      reportPath: dir.resolve('report.json'),
    })
    expect(readFileSync(outputPath, 'utf8')).toContain('42')
  })

  it('writes a CJS bundle when format is "cjs"', async () => {
    const inputPath = dir.write('input.mjs', 'export const value = 7\n')
    const outputPath = dir.resolve('out.cjs')
    const reportPath = dir.resolve('report.json')
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
    const inputPath = dir.write('input.mjs', "import other from 'other-dep'\nexport default other\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
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
    const inputPath = dir.write('input.mjs', "import other from 'other-dep/sub'\nexport default other\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
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

  it('marks node:-prefixed builtins as external', async () => {
    const inputPath = dir.write('input.mjs', "import { join } from 'node:path'\nexport default join('a', 'b')\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    expect(readFileSync(outputPath, 'utf8')).toMatch(/from\s+["']node:path["']/)
  })

  it('marks bare node builtins as external', async () => {
    const inputPath = dir.write('input.mjs', "import os from 'os'\nexport default os.tmpdir()\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    expect(readFileSync(outputPath, 'utf8')).toMatch(/from\s+["']os["']/)
  })

  it('suppresses circular-dependency warnings while still completing the bundle', async () => {
    dir.write('a.mjs', "import './b.mjs'\nexport const a = 1\n")
    dir.write('b.mjs', "import './a.mjs'\nexport const b = 2\n")
    const inputPath = dir.write('input.mjs', "export * from './a.mjs'\nexport * from './b.mjs'\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
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
    const inputPath = dir.write('input.mjs', "import ts from 'typescript'\nexport default ts\n")
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
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
    const inputPath = dir.write('input.mjs', "import ts from 'typescript/lib/typescript'\nexport default ts\n")
    const outputPath = dir.resolve('out.cjs')
    const reportPath = dir.resolve('report.json')
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
    const inputPath = dir.write('types.d.ts', 'export interface Hello { value: number }\n')
    const outputPath = dir.resolve('out.d.ts')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'dts',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
    })
    expect(readFileSync(outputPath, 'utf8')).toMatch(/interface Hello \{\s*value: number;?\s*\}/)
  })

  it('runs a workspace-js job over a TypeScript source entry', async () => {
    const inputPath = dir.write('input.ts', 'export const value: number = 99\n')
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: {
        module: 'es2022',
        moduleResolution: 'bundler',
        target: 'es2022',
        esModuleInterop: true,
        allowJs: true,
        strict: false,
        declaration: false,
        isolatedModules: true,
        rootDir: dir.path,
      },
      files: [inputPath],
    })
    const outputPath = dir.resolve('dist', 'out.esm.js')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
      tsConfigPath,
      workspaceRoot: dir.path,
    })
    expect(readFileSync(outputPath, 'utf8')).toContain('99')
  })

  it('compiles TS-only syntax in a workspace-js job whose tsconfig declares no rootDir and whose sources live outside the process cwd', async () => {
    const inputPath = dir.write('input.ts', 'export const value: number = 77\n')
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: {
        module: 'es2022',
        moduleResolution: 'bundler',
        target: 'es2022',
        esModuleInterop: true,
        allowJs: true,
        strict: false,
        declaration: false,
        isolatedModules: true,
      },
      files: [inputPath],
    })
    const outputPath = dir.resolve('dist', 'out.esm.js')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath: dir.resolve('report.json'),
      tsConfigPath,
      workspaceRoot: dir.path,
    })
    expect(readFileSync(outputPath, 'utf8')).toContain('77')
  })

  it('marks otherWorkspaceSpecifiers as external in workspace-js jobs (exact match only)', async () => {
    const inputPath = dir.write(
      'input.ts',
      "import { value } from '@x/sub'\nimport { other } from '@x/sub/deep'\nexport default { value, other }\n"
    )
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: {
        module: 'es2022',
        moduleResolution: 'bundler',
        target: 'es2022',
        esModuleInterop: true,
        allowJs: true,
        strict: false,
        declaration: false,
        isolatedModules: true,
        rootDir: dir.path,
      },
      files: [inputPath],
    })
    const outputPath = dir.resolve('dist', 'out.esm.js')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      otherWorkspaceSpecifiers: ['@x/sub'],
      outputPath,
      reportPath,
      tsConfigPath,
      workspaceRoot: dir.path,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']@x\/sub["']/)
  })

  it('throws when a workspace-js job is missing tsConfigPath', async () => {
    const inputPath = dir.write('input.ts', 'export const value = 1\n')
    const outputPath = dir.resolve('out.esm.js')
    const reportPath = dir.resolve('report.json')
    await expect(
      runPrePassWorkerJob({
        kind: 'workspace-js',
        dep: '@fixture/sample',
        inputPath,
        format: 'esm',
        otherDeps: [],
        outputPath,
        reportPath,
        workspaceRoot: dir.path,
      })
    ).rejects.toThrow(/missing tsConfigPath/)
  })

  it('throws when a workspace-dts job is missing workspaceRoot', async () => {
    const inputPath = dir.write('input.ts', 'export interface Hello { value: number }\n')
    const tsConfigPath = dir.write('tsconfig.json', { compilerOptions: { declaration: true } })
    const outputPath = dir.resolve('out.d.ts')
    const reportPath = dir.resolve('report.json')
    await expect(
      runPrePassWorkerJob({
        kind: 'workspace-dts',
        dep: '@fixture/sample',
        inputPath,
        format: 'esm',
        otherDeps: [],
        outputPath,
        reportPath,
        tsConfigPath,
      })
    ).rejects.toThrow(/missing workspaceRoot/)
  })

  it('runs a workspace-dts job over a TypeScript source entry', async () => {
    const inputPath = dir.write('input.ts', 'export interface Hello { value: number }\n')
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: {
        module: 'es2022',
        moduleResolution: 'bundler',
        target: 'es2022',
        declaration: true,
        emitDeclarationOnly: true,
      },
      include: ['**/*.ts'],
    })
    const outputPath = dir.resolve('dist', 'out.d.ts')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-dts',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
      tsConfigPath,
      workspaceRoot: dir.path,
    })
    expect(readFileSync(outputPath, 'utf8')).toMatch(/interface Hello \{\s*value: number;?\s*\}/)
  })

  it('rewrites cross-bundled-dep imports to relative paths under depsRoot when npmDeps is non-empty (js kind)', async () => {
    const inputPath = dir.write('input.mjs', "import other from 'other-dep'\nexport default other\n")
    const depsRoot = dir.resolve('_dependencies')
    const outputPath = join(depsRoot, 'fixture', 'index.mjs')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'js',
      dep: 'fixture',
      inputPath,
      format: 'esm',
      outputPath,
      otherDeps: ['other-dep'],
      reportPath,
      npmDeps: ['other-dep'],
      workspaceRoutes: [],
      depsRoot,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']\.\.\/other-dep\/index\.mjs["']/)
  })

  it('rewrites whole-surface workspace specifiers to relative chunk paths in workspace-js jobs', async () => {
    const inputPath = dir.write('input.ts', "import { logger } from '@hyperfrontend/logging'\nexport default logger\n")
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', isolatedModules: true, skipLibCheck: true },
    })
    const depsRoot = dir.resolve('_dependencies')
    const outputPath = join(depsRoot, '@hyperfrontend', 'logging', 'index.cjs')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@hyperfrontend/logging',
      inputPath,
      format: 'cjs',
      outputPath,
      otherDeps: [],
      reportPath,
      tsConfigPath,
      workspaceRoot: dir.path,
      npmDeps: [],
      workspaceRoutes: [{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }],
      depsRoot,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/require\(["']\.\/index\.cjs["']\)/)
  })

  it('rewrites sub-path workspace specifiers to relative sibling chunks (workspace-js, sub-path policy)', async () => {
    const inputPath = dir.write(
      'input.ts',
      "import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'\nexport default dateNow\n"
    )
    const tsConfigPath = dir.write('tsconfig.json', {
      compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', isolatedModules: true, skipLibCheck: true },
    })
    const depsRoot = dir.resolve('_dependencies')
    const outputPath = join(depsRoot, '@hyperfrontend', 'immutable-api-utils', 'built-in-copy', 'array', 'index.cjs')
    const reportPath = dir.resolve('report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@hyperfrontend/immutable-api-utils/built-in-copy/array',
      inputPath,
      format: 'cjs',
      outputPath,
      otherDeps: [],
      reportPath,
      tsConfigPath,
      workspaceRoot: dir.path,
      npmDeps: [],
      workspaceRoutes: [
        {
          packageName: '@hyperfrontend/immutable-api-utils',
          policy: 'sub-path',
          specifiers: ['@hyperfrontend/immutable-api-utils/built-in-copy/date'],
        },
      ],
      depsRoot,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/require\(["']\.\.\/date\/index\.cjs["']\)/)
  })
})

describe('onWarn', () => {
  it('suppresses warnings whose code is in the benign set', () => {
    const handler = jest.fn()
    onWarn({ code: 'CIRCULAR_DEPENDENCY', message: 'cycle' }, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses MISSING_EXPORT from @types module augmentations', () => {
    const handler = jest.fn()
    const warning: RollupLog = {
      code: 'MISSING_EXPORT',
      binding: 'Decorator',
      exporter: '/repo/node_modules/@types/estree/index.d.ts',
      message: '"Decorator" is not exported by "node_modules/@types/estree/index.d.ts"',
    }
    onWarn(warning, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards a genuine MISSING_EXPORT from a non-@types module', () => {
    const handler = jest.fn()
    const warning: RollupLog = {
      code: 'MISSING_EXPORT',
      binding: 'typo',
      exporter: '/repo/libs/foo/src/index.d.ts',
      message: '"typo" is not exported by "libs/foo/src/index.d.ts"',
    }
    onWarn(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })

  it('forwards a MISSING_EXPORT with no exporter (cannot be an augmentation miss)', () => {
    const handler = jest.fn()
    const warning: RollupLog = { code: 'MISSING_EXPORT', binding: 'thing', message: 'no exporter' }
    onWarn(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })

  it('forwards warnings that carry no code', () => {
    const handler = jest.fn()
    const warning: RollupLog = { message: 'heads up' }
    onWarn(warning, handler)
    expect(handler).toHaveBeenCalledWith(warning)
  })
})
