/**
 * ESM E2E tests for `@hyperfrontend/linter`: the installed package lints a project on disk from
 * code and from its `hf-lint` bin, runs a rule registered through `families`, and exposes its
 * secondary entries.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'

const PROJECT = mkdtempSync(join(tmpdir(), 'linter-e2e-'))
mkdirSync(join(PROJECT, 'src'))
writeFileSync(join(PROJECT, 'package.json'), '{ "name": "consumer", "type": "module" }\n')
writeFileSync(join(PROJECT, 'src', 'a.ts'), 'var total = 1\ndebugger\nexport { total as sum }\n')
writeFileSync(
  join(PROJECT, 'lint.config.mjs'),
  [
    'export default [',
    "  { families: { local: { 'no-total': { id: 'local/no-total', language: 'code', fixable: false, create: (context) => ({",
    "    Identifier(node) { if (node.name === 'total') context.report({ start: node.start, end: node.end, message: 'Rename total.' }) },",
    '  }) } } } },',
    "  { files: ['src/**/*.ts'], rules: { 'no-var': 'error', 'no-debugger': 'warn', 'local/no-total': 'error' } },",
    ']',
    '',
  ].join('\n')
)

/** The installed bin's entry, beside the package's manifest. */
const BIN = join(dirname(createRequire(import.meta.url).resolve('@hyperfrontend/linter/package.json')), 'bin', 'hf-lint.mjs')

describe('@hyperfrontend/linter ESM', () => {
  it('lints a project from code with a rule registered through families', async () => {
    const { lint } = await import('@hyperfrontend/linter')
    const report = await lint({ cwd: PROJECT, config: 'lint.config.mjs' })
    expect(report.results[0]?.messages.map((message) => `${message.line}:${message.column} ${message.ruleId}`)).toEqual([
      '1:1 no-var',
      '1:5 local/no-total',
      '2:1 no-debugger',
      '3:10 local/no-total',
    ])
  })

  it('applies fixes in memory when asked', async () => {
    const { lint } = await import('@hyperfrontend/linter')
    const report = await lint({ cwd: PROJECT, config: 'lint.config.mjs', fix: true })
    expect(report.results[0]?.output).toBe('let total = 1\ndebugger\nexport { total as sum }\n')
  })

  it('runs the hf-lint bin and exits with 1 on an error', () => {
    const result = spawnSync(process.execPath, [BIN, '--config', 'lint.config.mjs', '--format', 'json'], { cwd: PROJECT, encoding: 'utf8' })
    expect({
      status: result.status,
      rules: (JSON.parse(result.stdout) as { messages: { ruleId: string }[] }[])[0]?.messages.length,
    }).toEqual({
      status: 1,
      rules: 4,
    })
  })

  it('exposes the helpers and testing entries', async () => {
    const helpers = await import('@hyperfrontend/linter/helpers')
    const testing = await import('@hyperfrontend/linter/testing')
    expect([typeof helpers.parseCode, typeof helpers.scopeAnalysisOf, typeof testing.testRule]).toEqual([
      'function',
      'function',
      'function',
    ])
  })

  it('leaves no temporary project behind', () => {
    rmSync(PROJECT, { recursive: true, force: true })
    expect(existsSync(PROJECT)).toBe(false)
  })
})
