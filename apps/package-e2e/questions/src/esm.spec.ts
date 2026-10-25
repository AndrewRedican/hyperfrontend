/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/questions`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/questions'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { PromptResult, confirm, style } from '@hyperfrontend/questions'",
  "import { PassThrough } from 'node:stream'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/questions ESM', () => {
  it('is importable', async () => {
    const pkg = await import('@hyperfrontend/questions')
    expect(pkg).toBeDefined()
  })

  it('has exports', async () => {
    const pkg = await import('@hyperfrontend/questions')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  it('exports functions or objects', async () => {
    const pkg = await import('@hyperfrontend/questions')

    // At least one export should be a function, object, or class
    const exportTypes = Object.values(pkg).map((v) => typeof v)
    const hasValidExport = exportTypes.some((t) => ['function', 'object'].includes(t))
    expect(hasValidExport).toBe(true)
  })
})

describe('@hyperfrontend/questions ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('answers a confirm prompt driven through a terminal stream', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      result: 'submitted',
      value: true,
      submitted: 'submitted',
      asked: true,
      styled: true,
    })
  })
})
