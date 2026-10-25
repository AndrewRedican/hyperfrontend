/**
 * CJS E2E tests for `@hyperfrontend/linter`: the CommonJS build of every entry is requireable, and
 * the main entry lints a text against a configuration on disk.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/linter'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const PROJECT_FILES = {
  'lint-project/package.json': '{ "name": "consumer", "type": "module" }\n',
  'lint-project/src/a.js': 'var total = 1\ndebugger\nexport { total as sum }\n',
  'lint-project/lint.config.mjs': "export default [{ files: ['src/**/*.js'], rules: { 'no-var': 'error', 'no-debugger': 'warn' } }]\n",
}
const RUNNER = [
  "'use strict'",
  "const { lint } = require('@hyperfrontend/linter')",
  "const { join } = require('node:path')",
  'async function main() {',
  "  const cwd = join(process.cwd(), 'lint-project')",
  "  const report = await lint({ cwd, config: 'lint.config.mjs' })",
  "  const fixed = await lint({ cwd, config: 'lint.config.mjs', fix: true })",
  '  return {',
  '    messages: report.results[0].messages.map((message) => `${message.line}:${message.column} ${message.ruleId}`),',
  '    errorCount: report.errorCount,',
  '    warningCount: report.warningCount,',
  '    output: fixed.results[0].output,',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

const PROJECT = mkdtempSync(join(tmpdir(), 'linter-e2e-cjs-'))
writeFileSync(join(PROJECT, 'lint.config.mjs'), "export default [{ files: ['**/*.js'], rules: { 'no-debugger': 'error' } }]\n")

describe('@hyperfrontend/linter CJS', () => {
  it('requires the main entry and lints a text', async () => {
    const { lint } = require('@hyperfrontend/linter')
    const report = await lint({ cwd: PROJECT, config: 'lint.config.mjs', text: { path: 'a.js', text: 'debugger\n' } })
    expect(report.errorCount).toBe(1)
  })

  it('requires the secondary entries', () => {
    const helpers = require('@hyperfrontend/linter/helpers')
    const testing = require('@hyperfrontend/linter/testing')
    expect([typeof helpers.positionAt, typeof testing.testRule]).toEqual(['function', 'function'])
  })

  it('leaves no temporary project behind', () => {
    rmSync(PROJECT, { recursive: true, force: true })
    expect(existsSync(PROJECT)).toBe(false)
  })
})

describe('@hyperfrontend/linter CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      for (const [path, content] of Object.entries(PROJECT_FILES)) consumer.write(path, content)
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('lints and fixes a project on disk from code', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      messages: ['1:1 no-var', '2:1 no-debugger'],
      errorCount: 1,
      warningCount: 1,
      output: 'let total = 1\ndebugger\nexport { total as sum }\n',
    })
  })
})
