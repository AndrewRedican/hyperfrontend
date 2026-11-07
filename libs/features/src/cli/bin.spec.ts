import type { RunFeaturesCliOptions } from './bin'
import type { HandoverHost } from './handover'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { runFeaturesCli } from './bin'

/** A host in a project where the workspace package is not installed. */
const ALONE: HandoverHost = { resolve: () => null, load: () => promiseReject(createError('nothing to load')), nodeVersion: '24.0.0' }

const run = (
  argv: string[],
  cwd: string,
  host: HandoverHost = ALONE,
  handedOver?: boolean
): Promise<{ code: number; out: string; err: string }> => {
  const stdout = createCapturedOutput()
  const stderr = createCapturedOutput()
  return runFeaturesCli({ argv, cwd, stdout, stderr, handedOver }, host).then((code) => ({
    code,
    out: stdout.text(),
    err: stderr.text(),
  }))
}

/**
 * A host in a project where the workspace package is installed, whose command line records what
 * it is handed and writes a line of its own.
 *
 * @param calls - Where each invocation handed over is recorded.
 * @returns The host.
 */
function beside(calls: RunFeaturesCliOptions[]): HandoverHost {
  return {
    resolve: () => '/project/node_modules/@hyperfrontend/workspace/cli/index.cjs',
    load: () =>
      promiseResolve({
        runWorkspaceCli: (options: RunFeaturesCliOptions) => {
          calls.push(options)
          options.stdout.write('workspace usage\n')
          return promiseResolve(7)
        },
      }),
    nodeVersion: '24.0.0',
  }
}

describe('runFeaturesCli', () => {
  const tmp = useTempDir({ prefix: 'hf-bin-' })

  it('prints usage for --help', async () => {
    await expect(run(['--help'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 0, out: expect.stringContaining('Usage: hf') })
    )
  })

  it('fails when no command is given', async () => {
    await expect(run([], tmp.path)).resolves.toEqual(expect.objectContaining({ code: 1 }))
  })

  it('short-circuits to usage when --help follows a command', async () => {
    await expect(run(['init', '--help'], tmp.path)).resolves.toEqual(expect.objectContaining({ code: 0 }))
  })

  it('reports an unknown command', async () => {
    await expect(run(['frobnicate'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown command') })
    )
  })

  it('reports a parse error and prints usage', async () => {
    await expect(run(['--bogus'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown flag') })
    )
  })

  it('routes to the init command', async () => {
    await expect(run(['init', '--ci'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('--name') }))
  })

  it('routes to the build command', async () => {
    await expect(run(['build'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('Invalid config') }))
  })

  it('routes to the dev command', async () => {
    await expect(run(['dev'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('No hf-dev.config') }))
  })

  it('routes to the serve command', async () => {
    // why: A nonexistent --root fails serve's config resolution immediately, proving dispatch without leaving a server running.
    await expect(run(['serve', '--root', 'missing-root'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Serve root does not exist') })
    )
  })

  it('documents the serve command in usage', async () => {
    // why: The word "serve" also appears inside other command descriptions, so only the command's own usage line proves it is documented.
    await expect(run(['--help'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ out: expect.stringContaining('serve    Serve a built site for production') })
    )
  })

  it('passes a command it does not own to the workspace command line installed beside it, and answers with its exit code', async () => {
    await expect(run(['run', 'lib-a:test', '--coverage'], tmp.path, beside([]))).resolves.toEqual(expect.objectContaining({ code: 7 }))
  })

  it('passes the invocation on as it was received, marked as handed over', async () => {
    const calls: RunFeaturesCliOptions[] = []
    await run(['run-many', '-t', 'build'], tmp.path, beside(calls))
    expect(calls).toEqual([expect.objectContaining({ argv: ['run-many', '-t', 'build'], cwd: tmp.path, handedOver: true })])
  })

  it.each([['build'], ['--bogus'], ['--help', 'run']])('keeps %j, which starts with a command or a flag of its own', async (...argv) => {
    const calls: RunFeaturesCliOptions[] = []
    await run(argv, tmp.path, beside(calls))
    expect(calls.filter((call) => call.argv[0] !== '--help')).toEqual([])
  })

  it('reports an unknown command it was itself handed, without passing it back', async () => {
    await expect(run(['frobnicate'], tmp.path, beside([]), true)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown command') })
    )
  })

  it('follows its usage with the workspace usage where the workspace package is installed', async () => {
    await expect(run(['--help'], tmp.path, beside([]))).resolves.toEqual(
      expect.objectContaining({ code: 0, out: expect.stringMatching(/Usage: hf[\s\S]*workspace usage\n$/) })
    )
  })

  it('prints its usage alone when the workspace command line asked for it', async () => {
    await expect(run(['--help'], tmp.path, beside([]), true)).resolves.toEqual(
      expect.objectContaining({ out: expect.not.stringContaining('workspace usage') })
    )
  })
})
