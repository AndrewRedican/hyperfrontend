import type { Mock } from '@hyperfrontend/testing'
import type { ServicePlan } from './options-check'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from '@hyperfrontend/builder/bundle/rollup'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { bundleMain, mainBanner, mainDescriptor, runsThroughRunner } from './bundle'

jest.mock('@hyperfrontend/builder/bundle/rollup', () => ({ dispatchRollupWorker: jest.fn(), resolveDefaultRollupWorkerPath: jest.fn() }))

const mockDispatch = dispatchRollupWorker as Mock
const mockLocate = resolveDefaultRollupWorkerPath as Mock

const SEAL = { statement: 'globalThis[Symbol.for("key")] = 1;', digest: 'd'.repeat(64), key: 'key' }
const BANNER = '#!/usr/bin/env node\n\'use strict\';\nglobalThis[Symbol.for("key")] = 1;'

const PLAN = {
  project: 'hello',
  task: 'hello:build',
  workspaceRoot: '/repo',
  projectRoot: '/repo/apps/hello',
  sourceRoot: '/repo/apps/hello/src',
  entry: '/repo/apps/hello/src/main.ts',
  configFile: '/repo/apps/hello/service.config.ts',
  tsConfigPath: '/repo/apps/hello/tsconfig.lib.json',
  outputPath: '/repo/dist/apps/hello',
  assets: [],
} satisfies ServicePlan

/**
 * The message bundling a main rejects with.
 *
 * @returns The message, or empty text when the bundle was written
 */
async function refused(): Promise<string> {
  try {
    await bundleMain(mainDescriptor(PLAN, BANNER), 'service:hello')
    return ''
  } catch (error) {
    return (error as Error).message
  }
}

beforeEach(() => {
  mockDispatch.mockReset().mockReturnValue(promiseResolve({}))
  mockLocate.mockReset().mockReturnValue({ path: '/builder/worker/index.cjs', execArgv: ['--flag'] })
})

describe('mainBanner', () => {
  it('writes the interpreter, the strict directive and the seal, in that order', () => {
    expect(mainBanner(SEAL)).toBe(BANNER)
  })
})

describe('mainDescriptor', () => {
  it('describes one CommonJS main with every package inlined', () => {
    expect(mainDescriptor(PLAN, BANNER)).toEqual({
      format: 'cjs',
      inputFile: '/repo/apps/hello/src/main.ts',
      outputDir: '/repo/dist/apps/hello',
      external: [],
      sourcemap: false,
      bundledDepsPlugin: null,
      workspaceRoutes: [],
      tsConfigPath: '/repo/apps/hello/tsconfig.lib.json',
      projectRoot: '/repo/apps/hello',
      workspaceRoot: '/repo',
      bundleWorkspaceDeps: true,
      bundle: null,
      bin: {
        outputFile: join('/repo/dist/apps/hello', 'main.cjs'),
        banner: BANNER,
        footer: '',
        exports: 'auto',
        inlineDynamicImports: true,
        chmod: 0o755,
      },
      reportPath: '',
    })
  })
})

describe('bundleMain', () => {
  it('hands the job to the worker it located, under the label', async () => {
    await bundleMain(mainDescriptor(PLAN, BANNER), 'service:hello')
    expect(mockDispatch.mock.calls).toEqual([
      [mainDescriptor(PLAN, BANNER), { workerPath: '/builder/worker/index.cjs', execArgv: ['--flag'], label: 'service:hello' }],
    ])
  })

  it("throws the worker's failure on", async () => {
    mockDispatch.mockReturnValue(promiseReject(createError('rollup worker exited with code 1')))
    expect(await refused()).toBe('rollup worker exited with code 1')
  })

  it('refuses a worker that cannot be located', async () => {
    mockLocate.mockReturnValue(undefined)
    expect(await refused()).toBe(
      "the builder's rollup worker could not be located beside the builder module; the @hyperfrontend/workspace package appears incomplete."
    )
  })
})

describe('runsThroughRunner', () => {
  it('is true for the key in the body', () => {
    expect(runsThroughRunner(`${BANNER}\nconst stamp = Symbol.for('key')\n`, BANNER, 'key')).toBe(true)
  })

  it('is false for the key in the banner alone', () => {
    expect(runsThroughRunner(`${BANNER}\nconsole.log('hello')\n`, BANNER, 'key')).toBe(false)
  })
})
