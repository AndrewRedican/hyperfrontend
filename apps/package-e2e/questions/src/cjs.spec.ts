/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/questions`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/questions'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { PromptResult, confirm, style } = require('@hyperfrontend/questions')",
  "const { PassThrough } = require('node:stream')",
  'async function main() {',
  '  const input = new PassThrough()',
  '  input.isTTY = true',
  '  input.isRaw = false',
  '  input.setRawMode = (mode) => {',
  '    input.isRaw = mode',
  '    return input',
  '  }',
  '  const written = []',
  '  const output = new PassThrough()',
  '  output.isTTY = true',
  '  output.columns = 80',
  '  output.rows = 24',
  "  output.on('data', (chunk) => written.push(chunk.toString()))",
  "  const pending = confirm({ message: 'Continue?', input, output })",
  "  setImmediate(() => input.write('y'))",
  '  const outcome = await pending',
  '  return {',
  '    result: outcome.result,',
  '    value: outcome.value,',
  '    submitted: PromptResult.Submitted,',
  "    asked: written.join('').includes('Continue?'),",
  "    styled: style.bold('x') !== 'x' && style.bold('x').includes('x'),",
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/questions CJS', () => {
  it('is requireable', () => {
    const pkg = require('@hyperfrontend/questions')
    expect(pkg).toBeDefined()
  })

  it('has exports', () => {
    const pkg = require('@hyperfrontend/questions')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('exports functions or objects', () => {
    const pkg = require('@hyperfrontend/questions')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})

describe('@hyperfrontend/questions CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
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

  it('answers a confirm prompt driven through a terminal stream', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      result: 'submitted',
      value: true,
      submitted: 'submitted',
      asked: true,
      styled: true,
    })
  })
})
