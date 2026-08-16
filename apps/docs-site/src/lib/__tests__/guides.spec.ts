import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_CWD = process.cwd()

/**
 * Import a fresh copy of the guides loader with cwd pointed at a fixture
 * corpus, since the loader resolves `.generated/guides` from cwd at call time.
 *
 * @param fixture - Fixture directory name under __fixtures__
 * @returns The freshly imported loader module
 */
async function loadGuidesFrom(fixture: string) {
  process.chdir(resolve(ORIGINAL_CWD, 'src/lib/__tests__/__fixtures__', fixture))
  vi.resetModules()
  return import('../guides')
}

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
})

describe('guides loader', () => {
  it('returns an empty index when guides have not been generated', async () => {
    const { getGuideIndex } = await loadGuidesFrom('empty-corpus')
    expect(getGuideIndex()).toEqual([])
  })

  it('loads the compiled corpus index', async () => {
    const { getAllGuideSlugs } = await loadGuidesFrom('guides-corpus')
    expect(getAllGuideSlugs()).toEqual(['demo-guide', 'other-guide'])
  })

  it('loads a guide with its compiled content', async () => {
    const { getGuide } = await loadGuidesFrom('guides-corpus')
    expect(getGuide('demo-guide')).toEqual(expect.objectContaining({ title: 'Demo guide', content: '# Demo guide\n\nCompiled body.\n' }))
  })

  it('returns null for a slug missing from the index', async () => {
    const { getGuide } = await loadGuidesFrom('guides-corpus')
    expect(getGuide('nope')).toBeNull()
  })

  it('returns null for an indexed guide whose compiled file is missing', async () => {
    const { getGuide } = await loadGuidesFrom('guides-corpus')
    expect(getGuide('other-guide')).toBeNull()
  })

  it('lists guides for a package with the owned guide first', async () => {
    const { getGuidesForPackage } = await loadGuidesFrom('guides-corpus')
    expect(getGuidesForPackage('@hyperfrontend/nexus').map((guide) => guide.slug)).toEqual(['demo-guide', 'other-guide'])
  })
})
