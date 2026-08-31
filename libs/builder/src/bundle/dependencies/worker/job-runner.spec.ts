import type { RollupLog } from 'rollup'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { onWarn, runPrePassWorkerJob } from './job-runner'

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
    expect(report.endHeapMB).toBeGreaterThan(0)
    expect(report.endRssMB).toBeGreaterThan(0)
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

  it('runs a workspace-js job over a TypeScript source entry', async () => {
    const inputPath = writeSrc('input.ts', 'export const value: number = 99\n')
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: {
          module: 'es2022',
          moduleResolution: 'bundler',
          target: 'es2022',
          esModuleInterop: true,
          allowJs: true,
          strict: false,
          declaration: false,
          isolatedModules: true,
          rootDir: root,
        },
        files: [inputPath],
      })
    )
    const outputPath = join(root, 'dist', 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
      tsConfigPath,
      workspaceRoot: root,
    })
    expect(readFileSync(outputPath, 'utf8')).toContain('99')
  })

  it('compiles TS-only syntax in a workspace-js job whose tsconfig declares no rootDir and whose sources live outside the process cwd', async () => {
    const inputPath = writeSrc('input.ts', 'export const value: number = 77\n')
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
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
    )
    const outputPath = join(root, 'dist', 'out.esm.js')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath: join(root, 'report.json'),
      tsConfigPath,
      workspaceRoot: root,
    })
    expect(readFileSync(outputPath, 'utf8')).toContain('77')
  })

  it('marks otherWorkspaceSpecifiers as external in workspace-js jobs (exact match only)', async () => {
    const inputPath = writeSrc(
      'input.ts',
      "import { value } from '@x/sub'\nimport { other } from '@x/sub/deep'\nexport default { value, other }\n"
    )
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: {
          module: 'es2022',
          moduleResolution: 'bundler',
          target: 'es2022',
          esModuleInterop: true,
          allowJs: true,
          strict: false,
          declaration: false,
          isolatedModules: true,
          rootDir: root,
        },
        files: [inputPath],
      })
    )
    const outputPath = join(root, 'dist', 'out.esm.js')
    const reportPath = join(root, 'report.json')
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
      workspaceRoot: root,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/from\s+["']@x\/sub["']/)
  })

  it('throws when a workspace-js job is missing tsConfigPath', async () => {
    const inputPath = writeSrc('input.ts', 'export const value = 1\n')
    const outputPath = join(root, 'out.esm.js')
    const reportPath = join(root, 'report.json')
    await expect(
      runPrePassWorkerJob({
        kind: 'workspace-js',
        dep: '@fixture/sample',
        inputPath,
        format: 'esm',
        otherDeps: [],
        outputPath,
        reportPath,
        workspaceRoot: root,
      })
    ).rejects.toThrow(/missing tsConfigPath/)
  })

  it('throws when a workspace-dts job is missing workspaceRoot', async () => {
    const inputPath = writeSrc('input.ts', 'export interface Hello { value: number }\n')
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(tsConfigPath, JSON.stringify({ compilerOptions: { declaration: true } }))
    const outputPath = join(root, 'out.d.ts')
    const reportPath = join(root, 'report.json')
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
    const inputPath = writeSrc('input.ts', 'export interface Hello { value: number }\n')
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: {
          module: 'es2022',
          moduleResolution: 'bundler',
          target: 'es2022',
          declaration: true,
          emitDeclarationOnly: true,
        },
        include: ['**/*.ts'],
      })
    )
    const outputPath = join(root, 'dist', 'out.d.ts')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-dts',
      dep: '@fixture/sample',
      inputPath,
      format: 'esm',
      otherDeps: [],
      outputPath,
      reportPath,
      tsConfigPath,
      workspaceRoot: root,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toContain('Hello')
    expect(contents).toContain('value')
  })

  it('rewrites cross-bundled-dep imports to relative paths under depsRoot when npmDeps is non-empty (js kind)', async () => {
    const inputPath = writeSrc('input.mjs', "import other from 'other-dep'\nexport default other\n")
    const depsRoot = join(root, '_dependencies')
    const outputPath = join(depsRoot, 'fixture', 'index.esm.js')
    const reportPath = join(root, 'report.json')
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
    expect(contents).toMatch(/from\s+["']\.\.\/other-dep\/index\.esm\.js["']/)
  })

  it('rewrites whole-surface workspace specifiers to relative chunk paths in workspace-js jobs', async () => {
    const inputPath = writeSrc('input.ts', "import { logger } from '@hyperfrontend/logging'\nexport default logger\n")
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', isolatedModules: true, skipLibCheck: true },
      })
    )
    const depsRoot = join(root, '_dependencies')
    const outputPath = join(depsRoot, '@hyperfrontend', 'logging', 'index.cjs.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@hyperfrontend/logging',
      inputPath,
      format: 'cjs',
      outputPath,
      otherDeps: [],
      reportPath,
      tsConfigPath,
      workspaceRoot: root,
      npmDeps: [],
      workspaceRoutes: [{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }],
      depsRoot,
    })
    const contents = readFileSync(outputPath, 'utf8')
    expect(contents).toMatch(/require\(["']\.\/index\.cjs\.js["']\)/)
  })

  it('rewrites sub-path workspace specifiers to relative sibling chunks (workspace-js, sub-path policy)', async () => {
    const inputPath = writeSrc(
      'input.ts',
      "import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'\nexport default dateNow\n"
    )
    const tsConfigPath = join(root, 'tsconfig.json')
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', isolatedModules: true, skipLibCheck: true },
      })
    )
    const depsRoot = join(root, '_dependencies')
    const outputPath = join(depsRoot, '@hyperfrontend', 'immutable-api-utils', 'built-in-copy', 'array', 'index.cjs.js')
    const reportPath = join(root, 'report.json')
    await runPrePassWorkerJob({
      kind: 'workspace-js',
      dep: '@hyperfrontend/immutable-api-utils/built-in-copy/array',
      inputPath,
      format: 'cjs',
      outputPath,
      otherDeps: [],
      reportPath,
      tsConfigPath,
      workspaceRoot: root,
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
    expect(contents).toMatch(/require\(["']\.\.\/date\/index\.cjs\.js["']\)/)
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
