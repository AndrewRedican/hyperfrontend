import type { RollupBuildDescriptor } from '@hyperfrontend/builder/bundle/rollup'
import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import type { ServiceExecutorOptions } from './options'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from '@hyperfrontend/builder/bundle/rollup'
import { copyAssets } from '@hyperfrontend/builder/package/assets'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio } from '@hyperfrontend/testing/process'
import { logger } from '../shared/logger'
import { resolveFromWorkspace } from '../shared/workspace'
import { serviceExecutor } from './executor'

jest.mock('@hyperfrontend/builder/bundle/rollup', () => ({ dispatchRollupWorker: jest.fn(), resolveDefaultRollupWorkerPath: jest.fn() }))
jest.mock('@hyperfrontend/builder/package/assets', () => ({ copyAssets: jest.fn() }))
jest.mock('../shared/logger', () => ({ logger: { setLogLevel: jest.fn(), error: jest.fn(), debug: jest.fn() } }))
jest.mock('../shared/workspace', () => ({ resolveFromWorkspace: jest.fn() }))

const mockDispatch = dispatchRollupWorker as Mock
const mockLocate = resolveDefaultRollupWorkerPath as Mock
const mockCopy = copyAssets as Mock
const mockResolve = resolveFromWorkspace as Mock
const mockLevel = logger.setLogLevel as Mock
const mockError = logger.error as Mock
const mockDebug = logger.debug as Mock

const DIGEST = 'd'.repeat(64)
const RELEASE = 'e'.repeat(64)

/** The calls the fake kernel and the mocked builder record, in the order they were made. */
const calls: string[] = []

// why: the fake kernel is a CommonJS file the executor imports from the disk, and a global is the one thing it shares with the spec
;(globalThis as { hfServiceCalls?: string[] }).hfServiceCalls = calls

const KERNEL_ROOT = [
  'exports.sealServiceBuild = (immutable) => {',
  "  globalThis.hfServiceCalls.push('seal ' + JSON.stringify(immutable))",
  `  return { statement: 'globalThis.sealed = true;', digest: '${DIGEST}', key: 'RUNNER-KEY' }`,
  '}',
  '',
].join('\n')

/**
 * The text of a fake manifest entry of the kernel.
 *
 * @param issues - What verifying the release finds, as JavaScript source
 * @param refusal - The message the entry refuses a release with before it is built; none when empty
 * @returns The module's text
 */
function kernelManifest(issues: string, refusal = ''): string {
  return [
    "const { readdirSync } = require('node:fs')",
    'exports.createReleaseManifest = (input, listing) => {',
    '  if (listing) {',
    "    globalThis.hfServiceCalls.push('check ' + listing.list(input.root).map((entry) => entry.path).join(' '))",
    `    if (${JSON.stringify(refusal)}) throw new Error(${JSON.stringify(refusal)})`,
    '    return {}',
    '  }',
    "  globalThis.hfServiceCalls.push('create')",
    "  return { name: input.name, version: input.version, files: readdirSync(input.root).filter((file) => file !== 'hf-release.json').sort() }",
    '}',
    "exports.serializeReleaseManifest = (manifest) => (globalThis.hfServiceCalls.push('serialize'), JSON.stringify(manifest) + '\\n')",
    `exports.releaseManifestDigest = () => (globalThis.hfServiceCalls.push('digest'), '${RELEASE}')`,
    `exports.verifyRelease = () => (globalThis.hfServiceCalls.push('verify'), ${issues})`,
    '',
  ].join('\n')
}

/** A previous build of the service, as the files of its output directory. */
const PREVIOUS_BUILD = { 'dist/apps/hello/hf-release.json': { name: '@fixture/hello' }, 'dist/apps/hello/main.cjs': 'the previous build' }

const workspace = useTempDir({
  prefix: 'service-executor-',
  tree: {
    'apps/hello/package.json': { name: '@fixture/hello', version: '1.2.3' },
    'apps/hello/service.config.ts': "export default { immutable: { greeting: 'Hello' } }\n",
    'apps/hello/tsconfig.lib.json': {},
    'apps/hello/src/main.ts': '',
    'apps/hello/src/assets/notice.txt': 'a notice\n',
    'kernel/index.cjs': KERNEL_ROOT,
    'kernel/manifest.cjs': kernelManifest('[]'),
  },
})

/**
 * The context of a build task of the service at `apps/hello`.
 *
 * @param projectName - The project the task names
 * @returns The context, rooted at the temporary workspace
 */
function context(projectName = 'hello'): ExecutorContext {
  return {
    root: workspace.path,
    cwd: workspace.path,
    projectName,
    targetName: 'build',
    target: {},
    projects: { hello: { root: 'apps/hello' } },
    configuration: {},
  }
}

/**
 * Runs the executor, keeping what it prints.
 *
 * @param options - The options of the task
 * @param projectName - The project the task names
 * @returns Whether the build succeeded, and what it wrote to standard output
 */
async function run(options: ServiceExecutorOptions = {}, projectName = 'hello'): Promise<{ success: boolean; printed: string }> {
  const stdio = captureStdio({ stderr: false, passThrough: true })
  try {
    return { success: (await serviceExecutor(options, context(projectName))).success, printed: stdio.stdout() }
  } finally {
    stdio.restore()
  }
}

/**
 * The names the output directory holds.
 *
 * @returns The names in order, or null when the directory is absent
 */
function output(): readonly string[] | null {
  return workspace.exists('dist/apps/hello') ? readdirSync(workspace.resolve('dist/apps/hello')).sort() : null
}

beforeEach(() => {
  calls.length = 0
  for (const mock of [mockLevel, mockError, mockDebug, mockCopy]) mock.mockReset()
  mockResolve
    .mockReset()
    .mockImplementation((_from: string, specifier: string) =>
      workspace.resolve('kernel', specifier.endsWith('/manifest') ? 'manifest.cjs' : 'index.cjs')
    )
  mockLocate.mockReset().mockReturnValue({ path: '/builder/worker/index.cjs', execArgv: [] })
  mockDispatch.mockReset().mockImplementation((descriptor: RollupBuildDescriptor) => {
    calls.push('bundle')
    mkdirSync(descriptor.outputDir, { recursive: true })
    writeFileSync(join(descriptor.outputDir, 'main.cjs'), `${descriptor.bin?.banner}\nconst stamp = Symbol.for('RUNNER-KEY')\n`)
    return promiseResolve({})
  })
  mockCopy.mockImplementation(() => calls.push('assets'))
})

describe('serviceExecutor', () => {
  it('succeeds on a service that has everything', async () => {
    expect((await run()).success).toBe(true)
  })

  it('writes the main and both manifests', async () => {
    await run()
    expect(output()).toEqual(['hf-release.json', 'main.cjs', 'service.manifest.json'])
  })

  it('prints the digests of the release and of the immutable section on one line', async () => {
    expect((await run()).printed).toContain(`built hello release=${RELEASE} immutable=${DIGEST}\n`)
  })

  it('states the section and the digest of the seal in the service manifest', async () => {
    await run()
    expect(workspace.readJson('dist/apps/hello/service.manifest.json')).toEqual({
      schema: 1,
      immutable: { digest: DIGEST, value: { greeting: 'Hello' } },
    })
  })

  it('writes the release manifest the kernel serialised, under the name and version of the package', async () => {
    await run()
    expect(workspace.read('dist/apps/hello/hf-release.json')).toBe(
      '{"name":"@fixture/hello","version":"1.2.3","files":["main.cjs","service.manifest.json"]}\n'
    )
  })

  it('opens the main with the seal of the kernel', async () => {
    await run()
    expect(workspace.read('dist/apps/hello/main.cjs').startsWith("#!/usr/bin/env node\n'use strict';\nglobalThis.sealed = true;\n")).toBe(
      true
    )
  })

  it('seals, checks the release it is to write, bundles, copies and then writes the release, in that order', async () => {
    await run({ assets: ['assets/**'] })
    expect(calls).toEqual([
      'seal {"greeting":"Hello"}',
      `check main.cjs service.manifest.json ${join('assets', 'notice.txt')}`,
      'bundle',
      'assets',
      'create',
      'serialize',
      'verify',
      'digest',
    ])
  })

  it('copies the assets the globs match from the entry module directory', async () => {
    await run({ assets: ['assets/**'] })
    expect(mockCopy.mock.calls).toEqual([
      [[{ from: workspace.resolve('apps/hello/src'), files: ['assets/notice.txt'] }], workspace.resolve('dist/apps/hello'), {}],
    ])
  })

  it('seals an empty section when the configuration states none', async () => {
    workspace.write('apps/hello/service.config.ts', 'export default {}\n')
    await run()
    expect(calls[0]).toBe('seal {}')
  })

  it('builds over a previous build of the same service', async () => {
    workspace.writeTree({ 'dist/apps/hello/hf-release.json': { name: '@fixture/hello' }, 'dist/apps/hello/stale.txt': '' })
    await run()
    expect(output()).toEqual(['hf-release.json', 'main.cjs', 'service.manifest.json'])
  })

  it('logs at the log level by default', async () => {
    await run()
    expect(mockLevel.mock.calls).toEqual([['log']])
  })

  it('raises the log level under verbose', async () => {
    await run({ verbose: true })
    expect(mockLevel.mock.calls).toEqual([['debug']])
  })

  it('fails without a project name', async () => {
    expect({ result: await run({}, ''), logged: mockError.mock.calls }).toEqual({
      result: expect.objectContaining({ success: false }),
      logged: [['Project name is required']],
    })
  })

  it('fails on a project the workspace does not know', async () => {
    expect({ result: await run({}, 'absent'), logged: mockError.mock.calls }).toEqual({
      result: expect.objectContaining({ success: false }),
      logged: [['Could not find project configuration for absent']],
    })
  })

  it('fails on invalid options before anything is written', async () => {
    await run({ sourcemap: true } as ServiceExecutorOptions)
    expect({ output: output(), calls, logged: mockError.mock.calls[0]?.[0] }).toEqual({
      output: null,
      calls: [],
      logged: expect.stringContaining('Invalid options of hello:build:'),
    })
  })

  it('fails on a manifest that states no version before anything is written', async () => {
    workspace.write('apps/hello/package.json', { name: '@fixture/hello' })
    await run()
    expect({ output: output(), calls, logged: mockError.mock.calls }).toEqual({
      output: null,
      calls: [],
      logged: [['hello cannot be built:\n  - apps/hello/package.json must state a "version" as a non-empty string.']],
    })
  })

  it('fails on a source that reads import.meta as a built service cannot, before anything is written', async () => {
    workspace.write('apps/hello/src/routes/notice.ts', 'export const here = import.meta.dirname\n')
    await run()
    expect({ output: output(), calls, logged: mockError.mock.calls }).toEqual({
      output: null,
      calls: [],
      logged: [
        [
          'hello cannot be built as its sources stand:\n  - apps/hello/src/routes/notice.ts:1 uses import.meta.dirname, which a built service does not have; form a URL from import.meta.url.',
        ],
      ],
    })
  })

  it('fails on an invalid service configuration before anything is written', async () => {
    workspace.write('apps/hello/service.config.ts', 'export default { routes: [] }\n')
    await run()
    expect({ output: output(), calls, logged: mockError.mock.calls }).toEqual({
      output: null,
      calls: [],
      logged: [
        [
          'apps/hello/service.config.ts: invalid service configuration:\n  - the configuration has an unknown member "routes": it takes immutable.',
        ],
      ],
    })
  })

  it('fails on a kernel the sources do not resolve, before anything is written', async () => {
    mockResolve.mockReturnValue(null)
    await run()
    expect({ output: output(), calls, logged: mockError.mock.calls[0]?.[0] }).toEqual({
      output: null,
      calls: [],
      logged: expect.stringContaining('hello is built on @hyperfrontend/server 0.2.0 or later'),
    })
  })

  it('fails on an asset glob that matches nothing, and leaves the previous build as it was', async () => {
    workspace.writeTree(PREVIOUS_BUILD)
    await run({ assets: ['missing/**'] })
    expect({
      previous: workspace.read('dist/apps/hello/main.cjs'),
      bundled: calls.includes('bundle'),
      logged: mockError.mock.calls,
    }).toEqual({
      previous: 'the previous build',
      bundled: false,
      logged: [['Invalid options of hello:build:\n  - "assets[0]" matches no file.']],
    })
  })

  it('fails on a name or a version the kernel cannot release, and leaves the previous build as it was', async () => {
    workspace.writeTree(PREVIOUS_BUILD)
    workspace.write(
      'kernel/manifest.cjs',
      kernelManifest('[]', '/elsewhere/hf-release.json: invalid release manifest:\n  - version must be a semantic version such as 1.2.3.')
    )
    await run()
    expect({
      previous: workspace.read('dist/apps/hello/main.cjs'),
      bundled: calls.includes('bundle'),
      logged: mockError.mock.calls,
    }).toEqual({
      previous: 'the previous build',
      bundled: false,
      logged: [
        [
          'hello cannot be released under the name and version of apps/hello/package.json with the assets it copies:\n  - version must be a semantic version such as 1.2.3.',
        ],
      ],
    })
  })

  it('refuses an output directory that holds something else, and leaves it as it was', async () => {
    workspace.write('dist/apps/hello/keep.txt', 'mine')
    await run()
    expect({ output: output(), logged: mockError.mock.calls }).toEqual({
      output: ['keep.txt'],
      logged: [['the output directory dist/apps/hello holds something this build did not write; remove it or name another outputPath.']],
    })
  })

  it('fails on a main that does not run through the runner, and removes the output', async () => {
    mockDispatch.mockImplementation((descriptor: RollupBuildDescriptor) => {
      writeFileSync(join(descriptor.outputDir, 'main.cjs'), `${descriptor.bin?.banner}\nconsole.log('hello')\n`)
      return promiseResolve({})
    })
    expect({ result: (await run()).success, output: output(), logged: mockError.mock.calls }).toEqual({
      result: false,
      output: null,
      logged: [
        [
          'apps/hello/src/main.ts does not run the service through runService of @hyperfrontend/server, so the built service would start unchecked.',
        ],
      ],
    })
  })

  it('fails on a release that does not verify, and removes the output', async () => {
    workspace.write('kernel/manifest.cjs', kernelManifest("[{ message: 'main.cjs does not have the listed size.' }]"))
    expect({ result: (await run()).success, output: output(), logged: mockError.mock.calls }).toEqual({
      result: false,
      output: null,
      logged: [
        ['the release of hello does not verify against the directory the build wrote:\n  - main.cjs does not have the listed size.'],
      ],
    })
  })

  it('fails when the worker fails, and removes the output', async () => {
    mockDispatch.mockReturnValue(promiseReject(createError('rollup worker exited with code 1')))
    expect({ result: (await run()).success, output: output() }).toEqual({ result: false, output: null })
  })

  it('logs an error that is no refusal by its message, apart from its stack', async () => {
    mockDispatch.mockReturnValue(promiseReject(createError('rollup worker exited with code 1')))
    await run()
    expect({ errors: mockError.mock.calls, debug: mockDebug.mock.calls }).toEqual({
      errors: [['Failed to build hello'], ['Error: rollup worker exited with code 1']],
      debug: [[expect.stringMatching(/^Stack trace:\nError: rollup worker exited with code 1\n\s+at /)]],
    })
  })

  it('logs a refusal by its message alone', async () => {
    mockLocate.mockReturnValue(undefined)
    await run()
    expect({ errors: mockError.mock.calls, debug: mockDebug.mock.calls }).toEqual({
      errors: [
        [
          "the builder's rollup worker could not be located beside the builder module; the @hyperfrontend/workspace package appears incomplete.",
        ],
      ],
      debug: [],
    })
  })

  it('logs a thrown value that is no error as text', async () => {
    mockDispatch.mockReturnValue(promiseReject('out of memory'))
    await run()
    expect(mockError.mock.calls).toEqual([['out of memory']])
  })
})
