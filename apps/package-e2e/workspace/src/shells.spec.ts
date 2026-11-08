/**
 * Shell E2E tests for the `hf` executable of `@hyperfrontend/workspace`.
 *
 * The packed tarball is installed into a consumer, and every test types `npx hf` into a shell a person uses there: sh on
 * Linux and macOS, cmd and PowerShell on Windows. npm writes a different shim for each, and each must hand a flag with a
 * value, a project:target and a quoted comma list with a glob to hf unchanged, keep its two streams apart, and hand its
 * exit code back.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

/** A shell a person types `npx hf` into. */
type Shell = 'sh' | 'cmd' | 'pwsh'

/** The shells of this operating system. */
const SHELLS: readonly Shell[] = process.platform === 'win32' ? ['cmd', 'pwsh'] : ['sh']

/**
 * The relay the consumer runs: it starts the shell with the line typed into it and answers with the shell's exit code.
 * PowerShell takes the line encoded, so nothing between this process and the shell re-reads its quotes.
 */
const RELAY = [
  "'use strict'",
  "const { spawnSync } = require('node:child_process')",
  'const { HF_E2E_SHELL: shell, HF_E2E_LINE: line } = process.env',
  "const encoded = Buffer.from(`${line}\\nexit $LASTEXITCODE`, 'utf16le').toString('base64')",
  'const result =',
  "  shell === 'pwsh'",
  "    ? spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'inherit' })",
  "    : spawnSync(line, { shell: true, stdio: 'inherit' })",
  'if (result.error) throw result.error',
  'process.exitCode = result.status ?? 1',
  '',
].join('\n')

/** The workspace written into the consumer: two libraries, the second built after the first. */
const WORKSPACE = {
  'hf.json': { targetDefaults: { build: { dependsOn: ['^build'] } } },
  'libs/alpha/project.json': {
    name: 'alpha',
    targets: {
      build: { command: 'node -e "console.log(\'built alpha\')"' },
      echo: { command: 'node -e "console.log(process.argv.slice(1).join(\' \'))" --' },
      broken: { command: 'node -e "process.exit(3)"' },
    },
  },
  'libs/beta/project.json': {
    name: 'beta',
    implicitDependencies: ['alpha'],
    targets: { build: { command: 'node -e "console.log(\'built beta\')"' } },
  },
  'relay.cjs': RELAY,
}

const consumer = usePackedConsumer({ tarball: process.env['HF_E2E_TARBALL'] })

before(() => {
  consumer.writeTree(WORKSPACE)
})

/**
 * Types a line into a shell in the consumer.
 *
 * @param shell - Where the line is typed: sh, cmd or PowerShell
 * @param line - What a person types, starting with `npx hf`
 * @returns What the shell reported
 */
function type(shell: Shell, line: string): ConsumerRun {
  // why: the update check of npm writes to stderr on its own schedule, which the summary assertions read
  return consumer.node(['relay.cjs'], { env: { HF_E2E_SHELL: shell, HF_E2E_LINE: line, npm_config_update_notifier: 'false' } })
}

/**
 * The lines a run printed on one of its streams.
 *
 * @param text - What the stream took
 * @returns The lines that are not empty
 */
function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line !== '')
}

for (const shell of SHELLS) {
  describe(`npx hf typed into ${shell}`, () => {
    it('hands a flag with a value to hf', () => {
      const run = type(shell, 'npx hf show projects --with-target=build --json')
      expect({ status: run.status, projects: run.status === 0 ? JSON.parse(run.stdout) : run.stderr }).toEqual({
        status: 0,
        projects: ['alpha', 'beta'],
      })
    })

    it('hands a project:target and the arguments after it to hf', () => {
      expect(lines(type(shell, 'npx hf run alpha:echo --flag=1').stdout)).toEqual(['--flag=1'])
    })

    it('hands a quoted comma list with a glob to run-many, whose tasks print on stdout', () => {
      expect(lines(type(shell, 'npx hf run-many -t build -p "alpha,bet*"').stdout)).toEqual(['built alpha', 'built beta'])
    })

    it('prints the run-many summary on stderr', () => {
      const run = type(shell, 'npx hf run-many -t build -p "alpha,bet*"')
      expect({ status: run.status, summary: lines(run.stderr) }).toEqual({
        status: 0,
        summary: expect.arrayContaining([
          expect.stringContaining('succeeded alpha:build'),
          expect.stringContaining('succeeded beta:build'),
          '2 succeeded, 0 failed, 0 skipped',
        ]),
      })
    })

    it('hands the exit code of a task that fails back to the shell', () => {
      expect(type(shell, 'npx hf run alpha:broken').status).toBe(1)
    })
  })
}
