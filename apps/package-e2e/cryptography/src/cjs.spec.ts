/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/cryptography`
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: cryptography has platform-specific entries: ./browser, ./node, ./common
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/cryptography'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { createHash, decrypt, encrypt, isSHA256Hash } = require('@hyperfrontend/cryptography/node')",
  "const { isSHA256Hash: isSHA256HashCommon } = require('@hyperfrontend/cryptography/common')",
  'async function main() {',
  "  const hash = await createHash('abc')",
  "  const sealed = await encrypt('top secret', 'pa55word')",
  "  const opened = await decrypt(sealed, 'pa55word')",
  "  let wrongPassword = 'opened'",
  '  try {',
  "    await decrypt(sealed, 'other-pass')",
  '  } catch {',
  "    wrongPassword = 'rejected'",
  '  }',
  '  return {',
  '    hash,',
  '    validHash: isSHA256Hash(hash),',
  '    commonAgrees: isSHA256HashCommon(hash),',
  '    sealedIsBytes: sealed instanceof Uint8Array,',
  "    hidesPlaintext: !new TextDecoder().decode(sealed).includes('top secret'),",
  '    opened,',
  '    wrongPassword,',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/cryptography CJS', () => {
  describe('node sub-entry', () => {
    it('is requireable', () => {
      const nodeEntry = require('@hyperfrontend/cryptography/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports createHash function', () => {
      const { createHash } = require('@hyperfrontend/cryptography/node')
      expect(typeof createHash).toBe('function')
    })

    it('exports encrypt function', () => {
      const { encrypt } = require('@hyperfrontend/cryptography/node')
      expect(typeof encrypt).toBe('function')
    })

    it('exports decrypt function', () => {
      const { decrypt } = require('@hyperfrontend/cryptography/node')
      expect(typeof decrypt).toBe('function')
    })

    it('exports createVault function', () => {
      const { createVault } = require('@hyperfrontend/cryptography/node')
      expect(typeof createVault).toBe('function')
    })

    it('exports generateKey function', () => {
      const { generateKey } = require('@hyperfrontend/cryptography/node')
      expect(typeof generateKey).toBe('function')
    })

    it('exports getRandomValues function', () => {
      const { getRandomValues } = require('@hyperfrontend/cryptography/node')
      expect(typeof getRandomValues).toBe('function')
    })

    it('exports getTimeBasedPassword function', () => {
      const { getTimeBasedPassword } = require('@hyperfrontend/cryptography/node')
      expect(typeof getTimeBasedPassword).toBe('function')
    })

    it('exports isSHA256Hash function', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/node')
      expect(typeof isSHA256Hash).toBe('function')
    })
  })

  describe('common sub-entry', () => {
    it('is requireable', () => {
      const commonEntry = require('@hyperfrontend/cryptography/common')
      expect(commonEntry).toBeDefined()
    })

    it('exports isSHA256Hash function', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')
      expect(typeof isSHA256Hash).toBe('function')
    })

    it('isSHA256Hash accepts a well-formed SHA256 hash', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')

      // Valid SHA256 hashes are 64 hex characters
      const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

      expect(isSHA256Hash(validHash)).toBe(true)
    })

    it('isSHA256Hash rejects a string that is not a SHA256 hash', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')

      const invalidHash = 'not-a-hash'

      expect(isSHA256Hash(invalidHash)).toBe(false)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
  // as it uses Web Crypto API which requires browser context
})

describe('@hyperfrontend/cryptography CJS under plain Node in an isolated consumer', () => {
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

  it('hashes, encrypts and decrypts through the node entry', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      validHash: true,
      commonAgrees: true,
      sealedIsBytes: true,
      hidesPlaintext: true,
      opened: 'top secret',
      wrongPassword: 'rejected',
    })
  })
})
