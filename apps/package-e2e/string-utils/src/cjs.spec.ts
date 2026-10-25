/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/string-utils`
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: string-utils has platform-specific entries: ./browser, ./node
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/string-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { base64ToUint8Array, fromBase64, toBase64, uint8ArrayToBase64, uint8ArrayToUtf8String, utf8StringToUint8Array } = require('@hyperfrontend/string-utils/node')",
  'async function main() {',
  "  const original = 'Hello, World! 👋'",
  '  const bytes = utf8StringToUint8Array(original)',
  '  return {',
  '    bytesRoundTrip: uint8ArrayToUtf8String(bytes),',
  "    base64: toBase64('Hello, World!'),",
  '    base64RoundTrip: fromBase64(toBase64(original)),',
  '    bytesBase64RoundTrip: uint8ArrayToUtf8String(base64ToUint8Array(uint8ArrayToBase64(bytes))),',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/string-utils CJS', () => {
  describe('node sub-entry', () => {
    it('is requireable', () => {
      const nodeEntry = require('@hyperfrontend/string-utils/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports utf8StringToUint8Array function', () => {
      const { utf8StringToUint8Array } = require('@hyperfrontend/string-utils/node')
      expect(typeof utf8StringToUint8Array).toBe('function')
    })

    it('exports uint8ArrayToUtf8String function', () => {
      const { uint8ArrayToUtf8String } = require('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToUtf8String).toBe('function')
    })

    it('exports uint8ArrayToBase64 function', () => {
      const { uint8ArrayToBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToBase64).toBe('function')
    })

    it('exports base64ToUint8Array function', () => {
      const { base64ToUint8Array } = require('@hyperfrontend/string-utils/node')
      expect(typeof base64ToUint8Array).toBe('function')
    })

    it('exports arrayBufferToUtf8String function', () => {
      const { arrayBufferToUtf8String } = require('@hyperfrontend/string-utils/node')
      expect(typeof arrayBufferToUtf8String).toBe('function')
    })

    it('exports toBase64 function', () => {
      const { toBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof toBase64).toBe('function')
    })

    it('exports fromBase64 function', () => {
      const { fromBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof fromBase64).toBe('function')
    })

    it('correctly converts string to Uint8Array and back', () => {
      const { utf8StringToUint8Array, uint8ArrayToUtf8String } = require('@hyperfrontend/string-utils/node')

      const original = 'Hello, World! 👋'
      const uint8Array = utf8StringToUint8Array(original)
      const result = uint8ArrayToUtf8String(uint8Array)

      expect(result).toBe(original)
    })

    it('correctly converts to base64 and back', () => {
      const { toBase64, fromBase64 } = require('@hyperfrontend/string-utils/node')

      const original = 'Hello, World!'
      const base64 = toBase64(original)
      const result = fromBase64(base64)

      expect(result).toBe(original)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
})

describe('@hyperfrontend/string-utils CJS under plain Node in an isolated consumer', () => {
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

  it('round-trips text through bytes and base64 on the node entry', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      bytesRoundTrip: 'Hello, World! 👋',
      base64: 'SGVsbG8sIFdvcmxkIQ==',
      base64RoundTrip: 'Hello, World! 👋',
      bytesBase64RoundTrip: 'Hello, World! 👋',
    })
  })
})
