import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'
import { clearRegistrations, isMocked, mockedSource, registerSpecMocks } from './mock-registry'

const RUNTIME_URL = 'file:///workspace/tools/testing/src/mock/jest-api.ts'

const fixtureRoot = mkdtempSync(join(tmpdir(), 'hf-mock-registry-'))
writeFileSync(join(fixtureRoot, 'dep.ts'), 'export const read = (): number => 4\nexport const untouched = (): number => 5\n')
writeFileSync(join(fixtureRoot, 'defaulted.ts'), 'export const named = 1\nexport default 2\n')

const SPEC_URL = pathToFileURL(join(fixtureRoot, 'subject.spec.ts')).href
const DEP_URL = pathToFileURL(join(fixtureRoot, 'dep.ts')).href
const DEFAULTED_URL = pathToFileURL(join(fixtureRoot, 'defaulted.ts')).href

/**
 * Registers the mocks a source declares and returns the generated replacement.
 *
 * @param source - The spec source to read declarations from.
 * @param target - The mocked module's URL or built-in identifier.
 * @returns The replacement module's source.
 */
function sourceFor(source: string, target: string): string {
  registerSpecMocks(SPEC_URL, source)
  return mockedSource(target, RUNTIME_URL)
}

afterEach(() => clearRegistrations())

describe('registerSpecMocks', () => {
  it('registers a relative specifier under its resolved url', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('./dep.ts', () => ({ read: 1 }))")
    assert.equal(isMocked(DEP_URL), true)
  })

  it('registers a built-in under its own identifier', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('node:child_process', () => ({ spawnSync: 1 }))")
    assert.equal(isMocked('node:child_process'), true)
  })

  it('reports an unregistered module as unmocked', () => {
    assert.equal(isMocked(DEP_URL), false)
  })

  it('skips a specifier that resolves nowhere', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('nonexistent-package-xyz', () => ({}))")
    assert.equal(isMocked('nonexistent-package-xyz'), false)
  })
})

describe('mockedSource for a file module', () => {
  it('exports each name the factory defines', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /export const read = __hfNs\["read"\]/)
  })

  it('takes the real module from the captured namespace rather than a second import', () => {
    assert.equal(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL).includes('import * as __hfActual'), false)
  })

  it('keeps every other export reachable', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /export const untouched = __hfActual\["untouched"\]/)
  })

  it('does not pass an export through when the factory defines it', () => {
    assert.equal(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL).includes('__hfActual["read"]'), false)
  })

  it('gives the factory a requireActual that returns the real module', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /requireActual: \(\) => __hfActual/)
  })

  it('carries the factory through verbatim', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /const __hfNs = \(\(\) => \(\{ read: 1 \}\)\)\(\)/)
  })

  it('passes a default export through', () => {
    assert.match(sourceFor("jest.mock('./defaulted.ts', () => ({ named: 1 }))", DEFAULTED_URL), /export default __hfActual\["default"\]/)
  })

  it('replaces a default export the factory defines', () => {
    assert.equal(
      sourceFor("jest.mock('./defaulted.ts', () => ({ default: 1 }))", DEFAULTED_URL).includes('export default __hfActual'),
      false
    )
  })
})

describe('mockedSource for a built-in', () => {
  it('takes the real module from the captured namespace', () => {
    assert.match(
      sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'),
      /globalThis\[Symbol\.for\("hyperfrontend\.testing\.actuals"\)\]\.get\("node:path"\)/
    )
  })

  it('exports each name the factory defines', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /export const join = __hfNs\["join"\]/)
  })

  it('keeps every other export reachable', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /export const resolve = __hfActual\["resolve"\]/)
  })

  it('replaces every export with a mock function for an automock', () => {
    assert.match(sourceFor("jest.mock('node:path')", 'node:path'), /export const join = jest\.fn\(\)/)
  })

  it('leaves no factory call in an automock', () => {
    assert.equal(sourceFor("jest.mock('node:path')", 'node:path').includes('__hfNs'), false)
  })

  it('replaces a default export with a mock function for an automock', () => {
    assert.match(sourceFor("jest.mock('./defaulted.ts')", DEFAULTED_URL), /export default jest\.fn\(\)/)
  })
})

describe('mockedSource rejection', () => {
  it('refuses to build a replacement for an unregistered module', () => {
    assert.throws(() => mockedSource(DEP_URL, RUNTIME_URL), /no mock registered/)
  })
})
