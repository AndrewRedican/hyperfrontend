import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'
import {
  MOCK_SCHEME,
  clearRegistrations,
  isMocked,
  mockContext,
  mockTarget,
  mockedSource,
  registerRuntimeMock,
  registerSetupMocks,
  registerSpecMocks,
  resolveActualUrl,
} from './mock-registry'

const RUNTIME_URL = 'file:///workspace/tools/testing/src/mock/jest-api.ts'

const fixtureRoot = mkdtempSync(join(tmpdir(), 'hf-mock-registry-'))
writeFileSync(join(fixtureRoot, 'dep.ts'), 'export const read = (): number => 4\nexport const untouched = (): number => 5\n')

const SPEC_URL = pathToFileURL(join(fixtureRoot, 'subject.spec.ts')).href
const DEP_URL = pathToFileURL(join(fixtureRoot, 'dep.ts')).href
const SETUP_URL = pathToFileURL(join(fixtureRoot, 'test.setup.ts')).href

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

describe('registerSetupMocks', () => {
  it('registers a declaration a setup module makes for the whole project', () => {
    registerSetupMocks(SETUP_URL, "jest.mock('./dep.ts', () => ({ read: 1 }))")
    assert.equal(isMocked(DEP_URL), true)
  })

  it('leaves the spec context to the spec, so a relative specifier still resolves against it', () => {
    const before = mockContext().specUrl
    registerSetupMocks(SETUP_URL, "jest.mock('./dep.ts', () => ({ read: 1 }))")
    assert.equal(mockContext().specUrl, before)
  })

  it('is overridden by a spec declaring its own replacement for the same module', () => {
    registerSetupMocks(SETUP_URL, "jest.mock('./dep.ts', () => ({ read: () => 'setup' }))")
    registerSpecMocks(SPEC_URL, "jest.mock('./dep.ts', () => ({ read: () => 'spec' }))")
    assert.match(mockedSource(DEP_URL, RUNTIME_URL), /'spec'/)
  })
})

describe('mockedSource for a file module', () => {
  it('exports each name the factory defines', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /export \{ __hfExport\$read as read \}/)
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

  it('publishes the real namespace for jest.requireActual to read back', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /\.actuals\.set\("file:/)
  })
})

describe('mockedSource export aliasing', () => {
  it('binds an override to a local of another name, so the factory bare reference still means the global', () => {
    const source = sourceFor("jest.mock('./dep.ts', () => ({ read: () => read() }))", DEP_URL)
    assert.equal(source.includes('const read ='), false)
  })
})

describe('mockedSource publishing for requireMock', () => {
  it('publishes what a factory produced', () => {
    assert.match(sourceFor("jest.mock('./dep.ts', () => ({ read: 1 }))", DEP_URL), /\.mocks\.set\("file:[^)]*__hfNs\)/)
  })

  it('publishes the generated exports of an automock', () => {
    assert.match(sourceFor("jest.mock('node:path')", 'node:path'), /\.mocks\.set\("node:path", \{ [a-z]/)
  })
})

describe('mockedSource for a built-in', () => {
  it('imports the built-in it stands in for', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /import \* as __hfActual from "node:path"/)
  })

  it('exports each name the factory defines', () => {
    assert.match(sourceFor("jest.mock('node:path', () => ({ join: 1 }))", 'node:path'), /export \{ __hfExport\$join as join \}/)
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

describe('registerRuntimeMock', () => {
  it('registers a replacement declared while the suite runs', () => {
    mockContext().specUrl = SPEC_URL
    registerRuntimeMock('./dep.ts', () => ({ read: 2 }))
    assert.equal(isMocked(DEP_URL), true)
  })

  it('builds the replacement from the factory it was given', () => {
    mockContext().specUrl = SPEC_URL
    registerRuntimeMock('./dep.ts', () => ({ read: 2 }))
    assert.match(mockedSource(DEP_URL, RUNTIME_URL), /export \{ __hfExport\$read as read \}/)
  })
})

describe('mockContext', () => {
  it('records the url of the spec the loader read declarations from', () => {
    assert.match(mockContext().specUrl, /\.spec\.ts$/)
  })
})

describe('mockTarget', () => {
  it('reads the mocked url back out of a replacement url', () => {
    assert.equal(mockTarget(`${MOCK_SCHEME}${encodeURIComponent(DEP_URL)}?g=3`), DEP_URL)
  })

  it('reads a built-in identifier back out', () => {
    assert.equal(mockTarget(`${MOCK_SCHEME}node%3Aos?g=0`), 'node:os')
  })
})

describe('resolveActualUrl', () => {
  it('resolves a relative specifier to the module it names', () => {
    assert.equal(resolveActualUrl(createRequire(SPEC_URL), './dep.ts'), DEP_URL)
  })

  it('returns a built-in identifier without resolving it', () => {
    assert.equal(resolveActualUrl(createRequire(SPEC_URL), 'node:os'), 'node:os')
  })

  it('sees past a replacement the hooks resolved the specifier to', () => {
    const resolve = (): string => `${MOCK_SCHEME}${encodeURIComponent(DEP_URL)}?g=1`
    assert.equal(resolveActualUrl({ resolve } as unknown as NodeJS.Require, './dep.ts'), DEP_URL)
  })
})
