import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import hfReporter from './reporter'

/**
 * Runs the reporter over a fixed event stream and returns everything it printed.
 *
 * @param events - The events to feed it, as the test runner would.
 * @returns The rendered output.
 */
async function render(events: { type: string; data: unknown }[]): Promise<string> {
  const source = (async function* stream() {
    for (const event of events) yield event
  })()

  let output = ''
  for await (const chunk of hfReporter(source)) output += chunk
  return output
}

const PASSED = { type: 'test:pass', data: { name: 'a passing test', nesting: 0, testNumber: 1, details: { duration_ms: 1 } } }
const COVERAGE = {
  type: 'test:coverage',
  data: {
    summary: {
      files: [{ path: '/workspace/src/a.ts', lines: [], branches: [], functions: [] }],
      totals: {},
      workingDirectory: '/workspace',
    },
  },
}

describe('hfReporter', () => {
  it('renders the tests the run reported', async () => {
    assert.equal((await render([PASSED])).includes('a passing test'), true)
  })

  it('holds back Node coverage summary', async () => {
    assert.equal((await render([PASSED, COVERAGE])).includes('src/a.ts'), false)
  })

  it('renders nothing for a run with no events', async () => {
    assert.equal(await render([]), '')
  })
})
