import type { ChildProcess, SpawnOptions } from 'node:child_process'
import type { ExecutorContext } from '@hyperfrontend/integration-nx/compat'
import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorModule } from './executors'
import type { RunHost } from './run'
import { join, posix, relative, sep } from 'node:path'
import { after as afterAll } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { queueMicrotask } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { createRunnerWorkspace } from './__test-utils__/workspace'
import { main, runTask, USAGE } from './run'

const workspace = createRunnerWorkspace()
afterAll(() => workspace.remove())

/** A host and what it recorded. */
interface Recorded {
  /** The host. */
  readonly host: RunHost
  /** The lines the runner wrote. */
  readonly lines: string[]
  /** The commands started, with the directory each ran in. */
  readonly commands: (readonly [string, SpawnOptions['cwd']])[]
}

/**
 * A host over a workspace whose executor modules are the ones given, by workspace-relative
 * path, and whose commands are fakes exiting with code 0.
 *
 * @param modules - The modules an import answers, by workspace-relative POSIX path
 * @param root - The workspace root
 * @returns The host and what it recorded
 */
function recordingHost(modules: Readonly<Record<string, ExecutorModule>> = {}, root = workspace.path): Recorded {
  const lines: string[] = []
  const commands: (readonly [string, SpawnOptions['cwd']])[] = []
  const host: RunHost = {
    root,
    cwd: join(root, 'libs'),
    env: { PATH: '/bin' },
    platform: process.platform,
    execPath: process.execPath,
    spawn: (command, options) => {
      commands.push([command, options.cwd])
      const child = createFakeChildProcess()
      queueMicrotask(() => child.exit(0))
      return child as unknown as ChildProcess
    },
    write: (line) => {
      lines.push(line)
    },
    importModule: (file) => promiseResolve(modules[relative(root, file).split(sep).join(posix.sep)] ?? {}),
  }
  return { host, lines, commands }
}

/**
 * An executor resolving to a result, recording how it is called.
 *
 * @param success - What the result it resolves to says
 * @returns A mock resolving to `{ success }`
 */
function executor(success = true): Mock {
  return jest.fn(() => promiseResolve({ success }))
}

describe('main', () => {
  it.each([[[]], [['build', 'lib-alpha:build']], [['run']]])('answers %j with the usage and code 1', async (argv) => {
    const { host, lines } = recordingHost()
    const code = await main(argv, host)
    expect({ code, lines }).toEqual({ code: 1, lines: [USAGE] })
  })

  it('exits 0 when the executor succeeds', async () => {
    const { host } = recordingHost({ 'tools/tooling/src/build/executor.ts': { default: executor() } })
    expect(await main(['run', 'lib-alpha:build'], host)).toBe(0)
  })

  it('exits 1 when the executor fails', async () => {
    const { host } = recordingHost({ 'tools/tooling/src/version.ts': { default: executor(false) } })
    expect(await main(['run', 'lib-alpha:fails'], host)).toBe(1)
  })

  it('exits 1 with the reason when the task cannot run', async () => {
    const { host, lines } = recordingHost()
    const code = await main(['run', 'lib-omega:build'], host)
    expect({ code, lines }).toEqual({ code: 1, lines: ['hf run lib-omega:build: no project named lib-omega'] })
  })

  it('exits 1 with the stack when the executor throws', async () => {
    const thrown = createError('the executor broke')
    const { host, lines } = recordingHost({
      'tools/tooling/src/version.ts': {
        default: () => {
          throw thrown
        },
      },
    })
    const code = await main(['run', 'lib-alpha:throws'], host)
    expect({ code, lines }).toEqual({ code: 1, lines: [`hf run lib-alpha:throws: ${thrown.stack}`] })
  })

  it('refuses an argument after the task that is not an option', async () => {
    const { host, lines } = recordingHost()
    await main(['run', 'lib-alpha:build', 'plan'], host)
    expect(lines).toEqual(['hf run lib-alpha:build: expected --name=value or --name after the task, got plan'])
  })
})

describe('runTask', () => {
  it('calls the executor with the target options over the defaults, the arguments over both as their schema types them, and the schema defaults under all', async () => {
    const build = executor()
    const { host } = recordingHost({ 'tools/tooling/src/build/executor.ts': { default: build } })
    await runTask('lib-alpha:build', ['--mode=fast', '--retries=2', '--verbose'], host)
    expect(build.mock.calls[0]?.[0]).toEqual({
      outputPath: 'dist/libs/alpha',
      entry: 'libs/alpha/src/index.ts',
      mode: 'fast',
      retries: '2',
      verbose: true,
    })
  })

  it('calls the executor with the context of the task', async () => {
    const build = executor()
    const { host } = recordingHost({ 'tools/tooling/src/build/executor.ts': { default: build } })
    await runTask('lib-alpha:build', [], host)
    const context = build.mock.calls[0]?.[1] as ExecutorContext
    expect({
      root: context.root,
      cwd: context.cwd,
      projectName: context.projectName,
      targetName: context.targetName,
      target: context.target,
      projectRoot: context.projectsConfigurations.projects['lib-alpha']?.root,
      graphRoot: context.projectGraph.nodes['lib-alpha']?.data.root,
    }).toEqual({
      root: workspace.path,
      cwd: join(workspace.path, 'libs'),
      projectName: 'lib-alpha',
      targetName: 'build',
      target: {
        executor: '@fixture/tooling:build',
        options: { outputPath: 'dist/libs/alpha', mode: 'default', entry: 'libs/alpha/src/index.ts' },
      },
      projectRoot: 'libs/alpha',
      graphRoot: 'libs/alpha',
    })
  })

  it('calls the default export with the target options over the defaults of its executor', async () => {
    const check = executor()
    const { host } = recordingHost({ 'tools/tooling/src/check/executor.ts': { default: check } })
    await runTask('lib-alpha:check', [], host)
    expect(check.mock.calls[0]?.[0]).toEqual({ level: 'from-executor', strict: false })
  })

  it('runs a target whose name holds a colon', async () => {
    const version = executor()
    const { host } = recordingHost({ 'tools/tooling/src/version.ts': { default: version } })
    await runTask('lib-alpha:version:all', [], host)
    expect(version.mock.calls.length).toBe(1)
  })

  it('runs a target inheriting its command from the defaults in the project root', async () => {
    const { host, commands } = recordingHost()
    await runTask('lib-alpha:audit', ['--audit-level=high'], host)
    expect(commands).toEqual([['npm audit --audit-level=high', join(workspace.path, 'libs/alpha')]])
  })

  it('runs the bare command of the root project from the workspace root', async () => {
    const { host, commands } = recordingHost()
    await runTask('workspace:lint', [], host)
    expect(commands).toEqual([['node tools/lint/bin/lint.ts .', workspace.path]])
  })

  it('runs the lint target the linter gives a project from its root', async () => {
    const { host, commands } = recordingHost()
    await runTask('lib-alpha:lint', [], host)
    expect(commands).toEqual([['node ../../tools/lint/bin/lint.ts .', join(workspace.path, 'libs/alpha')]])
  })

  it('gives no lint target to a project the linter plugin excludes', async () => {
    await expect(runTask('demo-one:lint', [], recordingHost().host)).rejects.toThrow('project demo-one has no target lint')
  })

  it('refuses an executor whose module is missing', async () => {
    await expect(runTask('lib-alpha:broken', [], recordingHost().host)).rejects.toThrow(
      'the module implementing @fixture/tooling:missing is missing: ./src/missing'
    )
  })

  it('reads a workspace whose nx.json does not parse as one without defaults', async () => {
    const unreadable = createRunnerWorkspace({ 'nx.json': 'not json' })
    try {
      await expect(runTask('lib-alpha:build', [], recordingHost({}, unreadable.path).host)).rejects.toThrow(
        'lib-alpha:build names no executor and no command'
      )
    } finally {
      unreadable.remove()
    }
  })
})
