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

const SPEC_URL = pathToFileURL(join(fixtureRoot, 'subject.spec.ts')).href
const DEP_URL = pathToFileURL(join(fixtureRoot, 'dep.ts')).href

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

  it('imports the module it stands in for', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /import \* as __hfActual from "file:/)
  })

  it('keeps every other export reachable', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /export \* from "file:/)
  })

  it('gives the factory a requireActual that returns the real module', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /requireActual: \(\) => __hfActual/)
  })

  it('carries the factory through verbatim', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /const __hfNs = \(\(\) => \(\{ read: 1 \}\)\)\(\)/)
  })

  it('loads the module it stands in for only when the replacement is evaluated', () => {
    const source = sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL)
    assert.equal(source.includes('globalThis'), false)
  })
})

describe('mockedSource for a built-in', () => {
  it('imports the built-in it stands in for', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /import \* as __hfActual from "node:path"/)
  })

  it('exports each name the factory defines', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /export const join = __hfNs\["join"\]/)
  })

  it('keeps every other export reachable', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /export \* from "node:path"/)
  })

  it('replaces every export with a mock function for an automock', () => {
    assert.match(sourceFor("jest.mock('node:path')", 'node:path'), /export const join = __hfJest\.fn\(\)/)
  })

  it('leaves no factory call in an automock', () => {
    assert.equal(sourceFor("jest.mock('node:path')", 'node:path').includes('__hfNs'), false)
  })

  it('names every export of the module it automocks', () => {
    assert.match(sourceFor("jest.mock('node:path')", 'node:path'), /export const resolve = __hfJest\.fn\(\)/)
  })
})

describe('mockedSource rejection', () => {
  it('refuses to build a replacement for an unregistered module', () => {
    assert.throws(() => mockedSource(DEP_URL, RUNTIME_URL), /no mock registered/)
  })
})
