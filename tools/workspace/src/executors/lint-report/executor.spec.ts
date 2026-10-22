import type { ExecutorContext } from '@nx/devkit'
import type { Mock } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import lintReportExecutor from './executor'
jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }))
jest.mock('../../lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const mockExec = execFileSync as Mock

const root = mkdtempSync(join(tmpdir(), 'lint-report-'))
const context = {
  root,
  projectsConfigurations: {
    version: 2,
    projects: { workspace: { root: '.' }, 'lib-a': { root: 'libs/a' }, 'lib-b': { root: 'libs/b' }, 'lib-c': { root: 'libs/c' } },
  },
} as unknown as ExecutorContext
const report = (): string => readFileSync(join(root, 'lint-output.txt'), 'utf-8')

const findings = (severity: 'error' | 'warning'): string =>
  [`${join(root, 'libs', 'a', 'src', 'index.ts')}`, `  3:7  ${severity}  Unexpected any  typescript/no-explicit-any`, ''].join('\n')

const failedTasks = (...projects: string[]): string =>
  ['', 'Failed tasks:', '', ...projects.map((project) => `- ${project}:lint`), ''].join('\n')

const failure = (error: object): Error => Object.assign(new Error('Command failed'), error)

const failWith = (error: object): void => {
  mockExec.mockImplementation(() => {
    throw failure(error)
  })
}

const respondPerCommand = (responses: Record<string, string | Error>): void => {
  mockExec.mockImplementation((_command: string, args: string[]) => {
    const response = responses[args.slice(1, 3).join(' ')]
    if (response === undefined) throw new Error(`unexpected command: ${args.join(' ')}`)
    if (typeof response === 'string') return response
    throw response
  })
}

const rerunCommands = (): string[] =>
  mockExec.mock.calls.map(([, args]: [string, string[]]) => args.join(' ')).filter((command: string) => command.startsWith('nx run '))

beforeEach(() => mockExec.mockReset())

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('lintReportExecutor', () => {
  describe('clean run', () => {
    it('succeeds when lint reports no issues', async () => {
      mockExec.mockReturnValue('Successfully ran target lint for 3 projects\n')
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: true })
    })

    it('writes a report saying no issues were found', async () => {
      mockExec.mockReturnValue('Successfully ran target lint for 3 projects\n')
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('No issues found.'))
    })

    it('succeeds when only warnings were reported', async () => {
      mockExec.mockReturnValue(findings('warning'))
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: true })
    })

    it('lists the warnings in the report', async () => {
      mockExec.mockReturnValue(findings('warning'))
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('typescript/no-explicit-any'))
    })
  })

  describe('run with findings', () => {
    it('fails when failOnError is set', async () => {
      failWith({ status: 1, stdout: findings('error'), stderr: '' })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: false })
    })

    it('lists the errors in the report', async () => {
      failWith({ status: 1, stdout: findings('error'), stderr: '' })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('typescript/no-explicit-any'))
    })

    it('succeeds when failOnError is off', async () => {
      failWith({ status: 1, stdout: findings('error'), stderr: '' })
      expect(await lintReportExecutor({ failOnError: false }, context)).toEqual({ success: true })
    })
  })

  describe('crashed run', () => {
    it('fails when the command exits non-zero without any lint error', async () => {
      failWith({ status: 1, stdout: 'Oops! Something went wrong! :(\n', stderr: 'Error: rule threw\n' })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: false })
    })

    it('fails even when failOnError is off', async () => {
      failWith({ status: 1, stdout: 'Oops! Something went wrong! :(\n', stderr: '' })
      expect(await lintReportExecutor({ failOnError: false }, context)).toEqual({ success: false })
    })

    it('fails when the crash left only warnings behind', async () => {
      failWith({ status: 1, stdout: findings('warning'), stderr: 'Oops! Something went wrong! :(\n' })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: false })
    })

    it('reports the exit code of the command', async () => {
      failWith({ status: 2, stdout: 'Oops! Something went wrong! :(\n', stderr: '\u001B[31mError: rule threw\u001B[39m\n' })
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('`npx nx run-many -t=lint --fix` exited with code 2'))
    })

    it('reports the tail of the raw output without colour codes', async () => {
      failWith({ status: 2, stdout: 'Oops! Something went wrong! :(\n', stderr: '\u001B[31mError: rule threw\u001B[39m\n' })
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('Oops! Something went wrong! :(\nError: rule threw'))
    })

    it('never reports a crashed run as free of issues', async () => {
      failWith({ status: 2, stdout: 'Oops! Something went wrong! :(\n', stderr: '\u001B[31mError: rule threw\u001B[39m\n' })
      await lintReportExecutor({}, context)
      expect(report()).not.toEqual(expect.stringContaining('No issues found.'))
    })

    it('keeps only the last 80 lines of output', async () => {
      const lines = Array.from({ length: 200 }, (_, index) => `line-${index + 1}`)
      failWith({ status: 1, stdout: lines.join('\n'), stderr: '' })
      await lintReportExecutor({}, context)
      const content = report()
      expect({ keepsLine121: content.includes('line-121\n'), keepsLine120: content.includes('line-120\n') }).toEqual({
        keepsLine121: true,
        keepsLine120: false,
      })
    })

    it('fails when the command was killed', async () => {
      failWith({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })
      expect(await lintReportExecutor({}, context)).toEqual({ success: false })
    })

    it('reports the signal when the command was killed', async () => {
      failWith({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('was killed by SIGKILL'))
    })

    it('notes that a killed command left no output behind', async () => {
      failWith({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('(no output captured)'))
    })

    it('fails when the command could not be launched', async () => {
      failWith({ message: 'spawnSync npx ENOENT' })
      expect(await lintReportExecutor({ affected: true }, context)).toEqual({ success: false })
    })

    it('reports a command that could not be launched', async () => {
      failWith({ message: 'spawnSync npx ENOENT' })
      await lintReportExecutor({ affected: true }, context)
      expect(report()).toEqual(expect.stringContaining('`npx nx affected -t=lint --fix` could not be launched (spawnSync npx ENOENT)'))
    })
  })

  describe('run where some projects crashed', () => {
    const combined = (stdout: string): Error => failure({ status: 1, stdout, stderr: '' })
    const crash = failure({ status: 2, stdout: 'Oops! Something went wrong! :(\n', stderr: 'TypeError: rule threw\n' })
    const crashSevenProjects = (): void => {
      mockExec.mockImplementation((_command: string, args: string[]) => {
        throw args[1] === 'run-many' ? combined(failedTasks('p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7')) : crash
      })
    }

    it('fails when one project crashed and another reported errors', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'lib-b')),
        'run lib-b:lint': crash,
      })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: false })
    })

    it('counts the errors and the crashed projects in the summary', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'lib-b')),
        'run lib-b:lint': crash,
      })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('1 errors across 1 files, 0 warnings. 1 projects crashed before lint completed.'))
    })

    it('reports the crashed project with its rerun command, exit code and output tail', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'lib-b')),
        'run lib-b:lint': crash,
      })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(
        expect.stringContaining(
          [
            '**lib-b** `npx nx run lib-b:lint --fix` exited with code 2',
            '',
            '```',
            'Oops! Something went wrong! :(',
            'TypeError: rule threw',
            '```',
          ].join('\n')
        )
      )
    })

    it('keeps the findings of the other projects in the report when one project crashed', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'lib-b')),
        'run lib-b:lint': crash,
      })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('typescript/no-explicit-any'))
    })

    it('reruns only the failed projects that own no error', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'lib-b')),
        'run lib-b:lint': crash,
      })
      await lintReportExecutor({}, context)
      expect(rerunCommands()).toEqual(['nx run lib-b:lint --fix'])
    })

    it('fails on a crash even when failOnError is off', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-b')), 'run lib-b:lint': crash })
      expect(await lintReportExecutor({ failOnError: false }, context)).toEqual({ success: false })
    })

    it('reports a crash under the Crashed Projects heading', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-b')), 'run lib-b:lint': crash })
      await lintReportExecutor({ failOnError: false }, context)
      expect(report()).toEqual(expect.stringContaining('## Crashed Projects'))
    })

    it('fails on the crash of a failed project the workspace does not know', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-unknown')), 'run lib-unknown:lint': crash })
      expect(await lintReportExecutor({}, { root } as ExecutorContext)).toEqual({ success: false })
    })

    it('reports the crash of a failed project the workspace does not know', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-unknown')), 'run lib-unknown:lint': crash })
      await lintReportExecutor({}, { root } as ExecutorContext)
      expect(report()).toEqual(expect.stringContaining('**lib-unknown**'))
    })

    it('attributes an error to the deepest project containing the file', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(findings('error') + failedTasks('lib-a', 'workspace')),
        'run workspace:lint': crash,
      })
      await lintReportExecutor({}, context)
      expect(rerunCommands()).toEqual(['nx run workspace:lint --fix'])
    })

    it('succeeds when the failed project passes on its own', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-b')), 'run lib-b:lint': 'All files pass linting\n' })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: true })
    })

    it('reports no issues when the failed project passes on its own', async () => {
      respondPerCommand({ 'run-many -t=lint': combined(failedTasks('lib-b')), 'run lib-b:lint': 'All files pass linting\n' })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('No issues found.'))
    })

    it('fails on the errors a rerun surfaces when failOnError is set', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(failedTasks('lib-a')),
        'run lib-a:lint': failure({ status: 1, stdout: findings('error'), stderr: '' }),
      })
      expect(await lintReportExecutor({ failOnError: true }, context)).toEqual({ success: false })
    })

    it('reports the errors a rerun surfaces', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(failedTasks('lib-a')),
        'run lib-a:lint': failure({ status: 1, stdout: findings('error'), stderr: '' }),
      })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).toEqual(expect.stringContaining('typescript/no-explicit-any'))
    })

    it('reports no crash when a rerun surfaces errors', async () => {
      respondPerCommand({
        'run-many -t=lint': combined(failedTasks('lib-a')),
        'run lib-a:lint': failure({ status: 1, stdout: findings('error'), stderr: '' }),
      })
      await lintReportExecutor({ failOnError: true }, context)
      expect(report()).not.toEqual(expect.stringContaining('## Crashed Projects'))
    })

    it('fails when more projects crashed than it reruns', async () => {
      crashSevenProjects()
      expect(await lintReportExecutor({}, context)).toEqual({ success: false })
    })

    it('stops rerunning after five projects', async () => {
      crashSevenProjects()
      await lintReportExecutor({}, context)
      expect(rerunCommands()).toHaveLength(5)
    })

    it('lists the projects beyond the fifth as not rerun', async () => {
      crashSevenProjects()
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('**p7** failed without reporting a lint error (not rerun on its own)'))
    })

    it('counts every crashed project in the summary, rerun or not', async () => {
      crashSevenProjects()
      await lintReportExecutor({}, context)
      expect(report()).toEqual(expect.stringContaining('7 projects crashed before lint completed.'))
    })
  })
})
