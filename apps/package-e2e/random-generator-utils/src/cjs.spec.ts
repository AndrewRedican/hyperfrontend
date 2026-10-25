/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/random-generator-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/random-generator-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { createRandomGenerator, isUuidV4, randomUniform, uuidV4 } = require('@hyperfrontend/random-generator-utils')",
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
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/random-generator-utils CJS', () => {
  it('is requireable', () => {
    const randomGenerator = require('@hyperfrontend/random-generator-utils')
    expect(randomGenerator).toBeDefined()
  })

  it('exports uuidV4 function', () => {
    const { uuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof uuidV4).toBe('function')
  })

  it('generates a UUIDv4 as a string', () => {
    const { uuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(typeof uuid).toBe('string')
  })

  it('generates a UUIDv4 that isUuidV4 accepts', () => {
    const { uuidV4, isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    const uuid = uuidV4()
    expect(isUuidV4(uuid)).toBe(true)
  })

  it('exports isUuidV4 function', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')
    expect(typeof isUuidV4).toBe('function')
  })

  it('rejects a malformed string through isUuidV4', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('not-a-uuid')).toBe(false)
  })

  it('accepts a well-formed UUIDv4 through isUuidV4', () => {
    const { isUuidV4 } = require('@hyperfrontend/random-generator-utils')

    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('exports randomUniform function', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomUniform).toBe('function')
  })

  it('draws a uniform value no lower than the minimum', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
  })

  it('draws a uniform value below the maximum', () => {
    const { randomUniform } = require('@hyperfrontend/random-generator-utils')

    const value = randomUniform(0, 10)
    expect(value).toBeLessThan(10)
  })

  it('exports randomGaussian function', () => {
    const { randomGaussian } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomGaussian).toBe('function')
  })

  it('exports randomPseudo function', () => {
    const { randomPseudo } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPseudo).toBe('function')
  })

  it('exports randomExponential function', () => {
    const { randomExponential } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomExponential).toBe('function')
  })

  it('exports randomPowerLaw function', () => {
    const { randomPowerLaw } = require('@hyperfrontend/random-generator-utils')
    expect(typeof randomPowerLaw).toBe('function')
  })

  it('exports createRandomGenerator', () => {
    const { createRandomGenerator } = require('@hyperfrontend/random-generator-utils')
    expect(typeof createRandomGenerator).toBe('function')
  })

  it('replays one seed exactly through createRandomGenerator', () => {
    const { createRandomGenerator } = require('@hyperfrontend/random-generator-utils')

    const first = createRandomGenerator(42)
    const second = createRandomGenerator(42)
    expect([first.next(), first.gaussian(0, 10), first.uuidV4()]).toEqual([second.next(), second.gaussian(0, 10), second.uuidV4()])
  })
})

describe('@hyperfrontend/random-generator-utils CJS under plain Node in an isolated consumer', () => {
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

  it('generates identifiers, bounded draws and a replayable seeded stream', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      generated: true,
      rejects: false,
      accepts: true,
      withinBounds: true,
      replay: true,
    })
  })
})
