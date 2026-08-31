import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { clearRegistrations, isMocked, mockedSource, registerSpecMocks } from './mock-registry'

const SPEC_URL = 'file:///workspace/project/src/subject.spec.ts'
const RUNTIME_URL = 'file:///workspace/tools/testing/src/mock/jest-api.ts'

/**
 * Stands in for the resolver the hooks pass in, mapping a relative specifier to a URL.
 *
 * @param specifier - The specifier as written.
 * @returns A file URL for a relative specifier, otherwise undefined.
 */
function resolve(specifier: string): string | undefined {
  return specifier.startsWith('./') ? `file:///workspace/project/src/${specifier.slice(2)}.ts` : undefined
}

/**
 * Registers the mocks a source declares and returns the generated replacement.
 *
 * @param source - The spec source to read declarations from.
 * @param target - The mocked module's URL or built-in identifier.
 * @returns The replacement module's source.
 */
function sourceFor(source: string, target: string): string {
  registerSpecMocks(SPEC_URL, source, resolve)
  return mockedSource(target, RUNTIME_URL)
}

afterEach(() => clearRegistrations())

describe('registerSpecMocks', () => {
  it('registers a relative specifier under its resolved url', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('./dep', () => ({ read: 1 }))", resolve)
    assert.equal(isMocked('file:///workspace/project/src/dep.ts'), true)
  })

  it('registers a built-in under its own identifier', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('node:child_process', () => ({ spawnSync: 1 }))", resolve)
    assert.equal(isMocked('node:child_process'), true)
  })

  it('reports an unregistered module as unmocked', () => {
    assert.equal(isMocked('file:///workspace/project/src/other.ts'), false)
  })

  it('skips a specifier that resolves nowhere', () => {
    registerSpecMocks(SPEC_URL, "jest.mock('nonexistent-package-xyz', () => ({}))", resolve)
    assert.equal(isMocked('nonexistent-package-xyz'), false)
  })
})

describe('mockedSource for a file module', () => {
  it('exports each name the factory defines', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.match(source, /export const read = __hfNs\["read"\]/)
  })

  it('imports the module it stands in for', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.match(source, /import \* as __hfActual from "file:\/\/\/workspace\/project\/src\/dep\.ts\?__hf_actual"/)
  })

  it('passes the remaining exports through when the factory spreads', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ ...actual, read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.match(source, /export \* from "file:\/\/\/workspace\/project\/src\/dep\.ts\?__hf_actual"/)
  })

  it('replaces the module outright when the factory does not spread', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.equal(source.includes('export *'), false)
  })

  it('gives the factory a requireActual that returns the real module', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.match(source, /requireActual: \(\) => __hfActual/)
  })

  it('carries the factory through verbatim', () => {
    const source = sourceFor("jest.mock('./dep', () => ({ read: 1 }))", 'file:///workspace/project/src/dep.ts')
    assert.match(source, /const __hfNs = \(\(\) => \(\{ read: 1 \}\)\)\(\)/)
  })
})

describe('mockedSource for a built-in', () => {
  it('takes the real module from the captured namespace', () => {
    const source = sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path')
    assert.match(source, /globalThis\[Symbol\.for\("hyperfrontend\.testing\.actuals"\)\]\.get\("node:path"\)/)
  })

  it('exports each name the factory defines', () => {
    const source = sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path')
    assert.match(source, /export const join = __hfNs\["join"\]/)
  })

  it('does not pass other exports through when the factory does not spread', () => {
    const source = sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path')
    assert.equal(source.includes('__hfActual["resolve"]'), false)
  })

  it('passes other exports through when the factory spreads', () => {
    const source = sourceFor("jest.mock('node:path', () => ({ ...actual, join: 1 }))", 'node:path')
    assert.match(source, /export const resolve = __hfActual\["resolve"\]/)
  })

  it('replaces every export with a mock function for an automock', () => {
    const source = sourceFor("jest.mock('node:path')", 'node:path')
    assert.match(source, /export const join = jest\.fn\(\)/)
  })

  it('leaves no factory call in an automock', () => {
    const source = sourceFor("jest.mock('node:path')", 'node:path')
    assert.equal(source.includes('__hfNs'), false)
  })
})

describe('mockedSource rejection', () => {
  it('refuses to build a replacement for an unregistered module', () => {
    assert.throws(() => mockedSource('file:///workspace/project/src/absent.ts', RUNTIME_URL), /no mock registered/)
  })
})
