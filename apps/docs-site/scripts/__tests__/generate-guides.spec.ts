import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateGuides } from '../generate-guides'

const FIXTURES = 'apps/docs-site/scripts/__tests__/__fixtures__'

/**
 * Build a fixture library source rooted in the fixtures directory.
 *
 * @param dir - Fixture library directory name
 * @returns Library source pointing at the fixture
 */
function fixtureLib(dir: string) {
  return { name: 'Fixture', packageName: '@hyperfrontend/fixture', slug: 'fixture', srcPath: `${FIXTURES}/${dir}` }
}

describe('generateGuides validation gates', () => {
  it('fails when a guide unit lacks its guide.md pairing', () => {
    expect(() => generateGuides([fixtureLib('lib-pairing')])).toThrow(/failed with 1 error/)
  })

  it('aggregates malformed-metadata errors across units in one failing run', () => {
    let message = ''
    try {
      generateGuides([fixtureLib('lib-meta')])
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toMatch(/failed with 4 error/)
  })

  it('requires an authored guide to record the date its examples were run', () => {
    expect(() => generateGuides([fixtureLib('lib-meta')])).toThrow(/requires verifiedOn as an ISO date/)
  })

  it('requires a demo guide to name shipped source that exists', () => {
    expect(() => generateGuides([fixtureLib('lib-meta')])).toThrow(/verification\.source '.*nope\.spec\.ts' does not exist/)
  })

  it('fails on a dangling placeholder and an orphaned region together', () => {
    expect(() => generateGuides([fixtureLib('lib-snippets')])).toThrow(/failed with 2 error/)
  })

  it('writes no output for a corpus that fails validation', () => {
    try {
      generateGuides([fixtureLib('lib-snippets')])
    } catch {
      // why: The throw is the previous test's concern; this test observes the filesystem
    }
    expect(existsSync(resolve(process.cwd(), '.generated/guides/snippet-problems'))).toBe(false)
  })

  it('fails when two libraries claim the same guide slug', () => {
    expect(() => generateGuides([fixtureLib('lib-dup-a'), fixtureLib('lib-dup-b')])).toThrow(/slugs are global and must be unique/)
  })

  it('fails when a guide relates to a slug that does not exist', () => {
    expect(() => generateGuides([fixtureLib('lib-related')])).toThrow(/references guide 'nope'/)
  })

  it('requires guide.md to open with its title heading', () => {
    expect(() => generateGuides([fixtureLib('lib-heading')])).toThrow(/must start with a '# <Title>' heading/)
  })
})
