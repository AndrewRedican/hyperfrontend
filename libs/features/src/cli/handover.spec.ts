import type { RunFeaturesCliOptions } from './bin'
import type { HandoverHost } from './handover'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { handOver, processHost } from './handover'

/**
 * An invocation with captured output.
 *
 * @param argv - The arguments.
 * @returns The options, whose streams keep what they are written.
 */
function invocation(argv: string[]): RunFeaturesCliOptions & { stderr: ReturnType<typeof createCapturedOutput> } {
  return { argv, cwd: '/project', stdout: createCapturedOutput(), stderr: createCapturedOutput() }
}

/**
 * A host whose workspace command line answers with a fixed exit code.
 *
 * @param nodeVersion - The Node.js version the host reports.
 * @returns The host.
 */
function installed(nodeVersion: string): HandoverHost {
  return {
    resolve: () => '/project/node_modules/@hyperfrontend/workspace/cli/index.cjs',
    load: () => promiseResolve({ runWorkspaceCli: () => promiseResolve(3) }),
    nodeVersion,
  }
}

describe('handOver', () => {
  it('answers null where the workspace package is not installed', async () => {
    const alone: HandoverHost = { resolve: () => null, load: () => promiseReject(createError('nothing to load')), nodeVersion: '24.0.0' }
    await expect(handOver(invocation(['run', 'a:b']), alone)).resolves.toBeNull()
  })

  it('answers with the exit code of the workspace command line', async () => {
    await expect(handOver(invocation(['run', 'a:b']), installed('24.1.0'))).resolves.toBe(3)
  })

  it('fails on a Node.js older than the workspace command line runs on', async () => {
    await expect(handOver(invocation(['run', 'a:b']), installed('22.18.0'))).resolves.toBe(1)
  })

  it('says which Node.js the workspace commands need', async () => {
    const options = invocation(['run', 'a:b'])
    await handOver(options, installed('18.20.0'))
    expect(options.stderr.text()).toBe('The workspace commands of hf need Node.js 24 or later; this is 18.20.0.\n')
  })
})

describe('processHost', () => {
  const project = useTempDir({
    prefix: 'hf-handover-',
    tree: {
      'package.json': '{ "name": "project" }',
      'node_modules/@fixture/command-line/package.json': '{ "name": "@fixture/command-line", "exports": { "./cli": "./cli.cjs" } }',
      'node_modules/@fixture/command-line/cli.cjs': 'exports.runWorkspaceCli = (options) => Promise.resolve(options.argv.length)\n',
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
    const { runWorkspaceCli } = await host.load(host.resolve(project.path) as string)
    await expect(runWorkspaceCli(invocation(['run', 'a:b']))).resolves.toBe(2)
  })

  it('reports the running Node.js', () => {
    expect(processHost().nodeVersion).toBe(process.versions.node)
  })
})
