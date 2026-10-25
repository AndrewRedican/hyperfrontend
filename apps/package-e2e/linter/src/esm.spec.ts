/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/linter`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: the installed package lints a project on disk from code and from its `hf-lint` bin, runs a rule
 * registered through `families`, and exposes its secondary entries the way a consumer's `import` sees them.
 */

import { join } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

/** The project the installed linter is run over, with a rule of its own registered through `families`. */
const PROJECT = {
  'project/package.json': { name: 'consumer', type: 'module' },
  'project/src/a.ts': 'var total = 1\ndebugger\nexport { total as sum }\n',
  'project/lint.config.mjs': [
    'export default [',
    "  { families: { local: { 'no-total': { id: 'local/no-total', language: 'code', fixable: false, create: (context) => ({",
    "    Identifier(node) { if (node.name === 'total') context.report({ start: node.start, end: node.end, message: 'Rename total.' }) },",
    '  }) } } } },',
    "  { files: ['src/**/*.ts'], rules: { 'no-var': 'error', 'no-debugger': 'warn', 'local/no-total': 'error' } },",
    ']',
    '',
  ].join('\n'),
}

/** Where the lint runs from and which config it reads. */
interface LintTarget {
  /** The project directory. */
  cwd: string
  /** The config file, relative to it. */
  config: string
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

before(() => consumer.writeTree(PROJECT))

describe('@hyperfrontend/linter ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the helpers and testing entries', () => {
    const kinds = consumer.run(async () => {
      const helpers = await import('@hyperfrontend/linter/helpers')
      const testing = await import('@hyperfrontend/linter/testing')
      return [typeof helpers.parseCode, typeof helpers.scopeAnalysisOf, typeof testing.testRule]
    })
    expect(kinds).toEqual(['function', 'function', 'function'])
  })

  it('lints a project from code with a rule registered through families', () => {
    const messages = consumer.run(
      async (target: LintTarget) => {
        const { lint } = await import('@hyperfrontend/linter')
        const report = await lint({ cwd: target.cwd, config: target.config })
        return report.results[0]?.messages.map((message) => `${message.line}:${message.column} ${message.ruleId}`)
      },
      { args: { cwd: join(consumer.path, 'project'), config: 'lint.config.mjs' } }
    )
    expect(messages).toEqual(['1:1 no-var', '1:5 local/no-total', '2:1 no-debugger', '3:10 local/no-total'])
  })

  it('applies fixes in memory when asked', () => {
    const output = consumer.run(
      async (target: LintTarget) => {
        const { lint } = await import('@hyperfrontend/linter')
        const report = await lint({ cwd: target.cwd, config: target.config, fix: true })
        return report.results[0]?.output
      },
      { args: { cwd: join(consumer.path, 'project'), config: 'lint.config.mjs' } }
    )
    expect(output).toBe('let total = 1\ndebugger\nexport { total as sum }\n')
  })

  it('runs the hf-lint bin and exits with 1 on an error', () => {
    const bin = join(consumer.path, 'node_modules', '@hyperfrontend', 'linter', 'bin', 'hf-lint.mjs')
    const run = consumer.node([bin, '--config', 'lint.config.mjs', '--format', 'json'], { cwd: 'project' })
    const results = JSON.parse(run.stdout) as Array<{ messages: unknown[] }>
    expect({ status: run.status, messages: results[0]?.messages.length }).toEqual({ status: 1, messages: 4 })
  })
})
