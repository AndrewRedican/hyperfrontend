/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/random-generator-utils`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/random-generator-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { createRandomGenerator, isUuidV4, randomUniform, uuidV4 } from '@hyperfrontend/random-generator-utils'",
  'async function main() {',
  '  const first = createRandomGenerator(42)',
  '  const second = createRandomGenerator(42)',
  '  const firstDraws = [first.next(), first.gaussian(0, 10), first.uuidV4()]',
  '  const secondDraws = [second.next(), second.gaussian(0, 10), second.uuidV4()]',
  '  const draws = Array.from({ length: 50 }, () => randomUniform(0, 10))',
  '  return {',
  '    generated: isUuidV4(uuidV4()),',
  "    rejects: isUuidV4('not-a-uuid'),",
  "    accepts: isUuidV4('550e8400-e29b-41d4-a716-446655440000'),",
  '    withinBounds: draws.every((value) => value >= 0 && value < 10),',
  '    replay: JSON.stringify(firstDraws) === JSON.stringify(secondDraws),',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/random-generator-utils ESM', () => {
  it('is importable', async () => {
    const randomGenerator = await import('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('exports uuidV4 function', async () => {
    const { uuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('generates a UUIDv4 as a string', async () => {
    const { uuidV4 } = await import('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
  })

  it('generates a UUIDv4 that isUuidV4 accepts', async () => {
    const { uuidV4, isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('exports isUuidV4 function', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')
  })

  it('rejects a malformed string through isUuidV4', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('not-a-uuid')).toBe(false)
  })

  it('accepts a well-formed UUIDv4 through isUuidV4', async () => {
    const { isUuidV4 } = await import('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('exports randomUniform function', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')
  })

  it('draws a uniform value no lower than the minimum', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
  })

  it('draws a uniform value below the maximum', async () => {
    const { randomUniform } = await import('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeLessThan(10)
  })

  it('exports randomGaussian function', async () => {
    const { randomGaussian } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('exports randomPseudo function', async () => {
    const { randomPseudo } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('exports randomExponential function', async () => {
    const { randomExponential } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('exports randomPowerLaw function', async () => {
    const { randomPowerLaw } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })

  it('exports createRandomGenerator', async () => {
    const { createRandomGenerator } = await import('@hyperfrontend/random-generator-utils')
    expect(typeof createRandomGenerator).toBe('function')
  })

  it('replays one seed exactly through createRandomGenerator', async () => {
    const { createRandomGenerator } = await import('@hyperfrontend/random-generator-utils')

    const first = createRandomGenerator(42)
    const second = createRandomGenerator(42)
    expect([first.next(), first.gaussian(0, 10), first.uuidV4()]).toEqual([second.next(), second.gaussian(0, 10), second.uuidV4()])
  })
})

describe('@hyperfrontend/random-generator-utils ESM under plain Node in an isolated consumer', () => {
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

  it('generates identifiers, bounded draws and a replayable seeded stream', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      generated: true,
      rejects: false,
      accepts: true,
      withinBounds: true,
      replay: true,
    })
  })
})
