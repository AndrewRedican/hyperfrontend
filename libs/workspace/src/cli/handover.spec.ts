import type { HandoverHost, Invocation } from './handover'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { FEATURES_CLI, handOver, processHost } from './handover'

/**
 * A run with captured output.
 *
 * @param argv - The arguments
 * @returns The run
 */
function invocation(argv: string[]): Invocation {
  return { argv, cwd: '/project', stdout: createCapturedOutput(), stderr: createCapturedOutput() }
}

describe('handOver', () => {
  it('answers null where the features package is not installed', async () => {
    const alone: HandoverHost = { resolve: () => null, load: () => promiseReject(createError('nothing to load')) }
    await expect(handOver(invocation(['build']), alone)).resolves.toBeNull()
  })

  it('answers with the exit code of the features command line', async () => {
    const beside: HandoverHost = {
      resolve: () => '/project/node_modules/@hyperfrontend/features/cli/index.cjs',
      load: () => promiseResolve({ runFeaturesCli: () => promiseResolve(5) }),
    }
    await expect(handOver(invocation(['build']), beside)).resolves.toBe(5)
  })

  it('passes the run on as it was received, marked as handed over', async () => {
    const received: Invocation[] = []
    const beside: HandoverHost = {
      resolve: () => '/project/node_modules/@hyperfrontend/features/cli/index.cjs',
      load: () =>
        promiseResolve({
          runFeaturesCli: (passed: Invocation) => {
            received.push(passed)
            return promiseResolve(0)
          },
        }),
    }
    await handOver(invocation(['build', '--protocol', 'v4']), beside)
    expect(received).toEqual([expect.objectContaining({ argv: ['build', '--protocol', 'v4'], cwd: '/project', handedOver: true })])
  })
})

describe('processHost', () => {
  const project = useTempDir({
    prefix: 'hf-handover-',
    tree: {
      'package.json': '{ "name": "project" }',
      'node_modules/@fixture/command-line/package.json': '{ "name": "@fixture/command-line", "exports": { "./cli": "./cli.cjs" } }',
      'node_modules/@fixture/command-line/cli.cjs': 'exports.runFeaturesCli = (invocation) => Promise.resolve(invocation.argv.length)\n',
      'apps/site/keep.txt': '',
    },
  })

  it('resolves the command line of a package installed above the directory the command ran in', () => {
    expect(processHost('@fixture/command-line/cli').resolve(join(project.path, 'apps', 'site'))).toBe(
      join(project.path, 'node_modules', '@fixture', 'command-line', 'cli.cjs')
    )
  })

  it('resolves nothing for a package that is not installed', () => {
    expect(processHost('@fixture/absent/cli').resolve(project.path)).toBeNull()
  })

  it('loads the command line it resolved', async () => {
    const host = processHost('@fixture/command-line/cli')
    const { runFeaturesCli } = await host.load(host.resolve(project.path) as string)
    await expect(runFeaturesCli(invocation(['build', '--out', 'dist']))).resolves.toBe(3)
  })

  it('looks for the features command line unless told otherwise', () => {
    expect(processHost().resolve(project.path)).toBe(processHost(FEATURES_CLI).resolve(project.path))
  })
})
