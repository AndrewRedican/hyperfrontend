/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/cryptography`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: cryptography has platform-specific entries: ./browser, ./node, ./common
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/cryptography'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { createHash, decrypt, encrypt, isSHA256Hash } from '@hyperfrontend/cryptography/node'",
  "import { isSHA256Hash as isSHA256HashCommon } from '@hyperfrontend/cryptography/common'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/cryptography ESM', () => {
  describe('node sub-entry', () => {
    it('is importable', async () => {
      const nodeEntry = await import('@hyperfrontend/cryptography/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports createHash function', async () => {
      const { createHash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createHash).toBe('function')
    })

    it('exports encrypt function', async () => {
      const { encrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof encrypt).toBe('function')
    })

    it('exports decrypt function', async () => {
      const { decrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof decrypt).toBe('function')
    })

    it('exports createVault function', async () => {
      const { createVault } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createVault).toBe('function')
    })

    it('exports generateKey function', async () => {
      const { generateKey } = await import('@hyperfrontend/cryptography/node')
      expect(typeof generateKey).toBe('function')
    })

    it('exports getRandomValues function', async () => {
      const { getRandomValues } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getRandomValues).toBe('function')
    })

    it('exports getTimeBasedPassword function', async () => {
      const { getTimeBasedPassword } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getTimeBasedPassword).toBe('function')
    })

    it('exports isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof isSHA256Hash).toBe('function')
    })
  })

  describe('common sub-entry', () => {
    it('is importable', async () => {
      const commonEntry = await import('@hyperfrontend/cryptography/common')
      expect(commonEntry).toBeDefined()
    })

    it('exports isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')
      expect(typeof isSHA256Hash).toBe('function')
    })

    it('isSHA256Hash accepts a well-formed SHA256 hash', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')

      // Valid SHA256 hashes are 64 hex characters
      const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

      expect(isSHA256Hash(validHash)).toBe(true)
    })

    it('isSHA256Hash rejects a string that is not a SHA256 hash', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')

      const invalidHash = 'not-a-hash'

      expect(isSHA256Hash(invalidHash)).toBe(false)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
  // as it uses Web Crypto API which requires browser context
})

describe('@hyperfrontend/cryptography ESM under plain Node in an isolated consumer', () => {
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

  it('hashes, encrypts and decrypts through the node entry', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
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
