import type { LibraryFactsInput } from './library-facts'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  ECOSYSTEM_TIER_IDS,
  defaultDocsCategory,
  defaultEcosystemTier,
  deriveLibraryFacts,
  displayNameFor,
  entryPointsOf,
  isUtilsRoot,
  locationName,
  routeSlugFor,
  secondaryEntriesOf,
} from './library-facts'

/** A node-only package with secondary entries and a document of its design. */
const TESTING: LibraryFactsInput = {
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: 'Jest-style testing on node:test.',
  tags: ['type:core', 'scope:public'],
  exports: {
    '.': './src/index.js',
    './runner': './src/runner/index.js',
    './hooks': './src/hooks/index.js',
    './package.json': './package.json',
  },
  hasArchitecture: true,
}

describe('isUtilsRoot', () => {
  it('recognises a project under libs/utils and nothing else', () => {
    expect([isUtilsRoot('libs/utils/json'), isUtilsRoot('libs/utils'), isUtilsRoot('libs/json'), isUtilsRoot('tools/utils/x')]).toEqual([
      true,
      false,
      false,
      false,
    ])
  })
})

describe('locationName', () => {
  it('suffixes a utility with -utils and names anything else by its last segment', () => {
    expect([locationName('libs/utils/json'), locationName('libs/network-protocol'), locationName('plugins/x/')]).toEqual([
      'json-utils',
      'network-protocol',
      'x',
    ])
  })
})

describe('routeSlugFor', () => {
  it('routes a utility under utils and anything else by its last segment', () => {
    expect([routeSlugFor('libs/utils/json'), routeSlugFor('libs/questions')]).toEqual(['utils/json', 'questions'])
  })
})

describe('displayNameFor', () => {
  it('capitalises each hyphenated word', () => {
    expect(displayNameFor('random-generator-utils')).toBe('Random Generator Utils')
  })
})

describe('defaultDocsCategory', () => {
  it('lists a utility under utils whatever its tags say', () => {
    expect(defaultDocsCategory('libs/utils/json', ['type:core'])).toBe('utils')
  })

  it('lists a core project under core', () => {
    expect(defaultDocsCategory('libs/testing', ['type:core', 'scope:public'])).toBe('core')
  })

  it('lists any other project as supporting', () => {
    expect(defaultDocsCategory('libs/questions', ['type:util'])).toBe('supporting')
  })
})

describe('defaultEcosystemTier', () => {
  it('places a utility on the utilities level and anything else on the standalone level', () => {
    expect([defaultEcosystemTier('utils'), defaultEcosystemTier('core'), defaultEcosystemTier('supporting')]).toEqual([
      'utilities',
      'standalone',
      'standalone',
    ])
  })

  it('names levels the hierarchy has', () => {
    expect(ECOSYSTEM_TIER_IDS).toEqual(expect.arrayContaining([defaultEcosystemTier('utils'), defaultEcosystemTier('core')]))
  })
})

describe('secondaryEntriesOf', () => {
  it('lists every subpath but the main entry, the manifest and patterns, sorted', () => {
    expect(secondaryEntriesOf({ ...TESTING.exports, './*': './src/*.js', types: './src/index.d.ts' })).toEqual(['hooks', 'runner'])
  })
})

describe('entryPointsOf', () => {
  it('maps each export to its TypeScript source, main entry first, skipping the manifest and patterns', () => {
    expect(entryPointsOf('libs/testing', { ...TESTING.exports, './*': './src/*.js' })).toEqual([
      'libs/testing/src/index.ts',
      'libs/testing/src/runner/index.ts',
      'libs/testing/src/hooks/index.ts',
    ])
  })

  it('reads a conditional export through import, then default, then require', () => {
    expect(
      entryPointsOf('libs/x', {
        '.': { import: './src/a.js', default: './src/b.js' },
        './b': { default: './src/b.js', require: './src/c.js' },
        './c': { require: './src/c.js' },
        './d': { types: './src/d.d.ts' },
        './e': 42,
      })
    ).toEqual(['libs/x/src/a.ts', 'libs/x/src/b.ts', 'libs/x/src/c.ts'])
  })

  it('points a directory export at its index and lists a source once', () => {
    expect(entryPointsOf('libs/x', { '.': 'src/index.js', './dir': './src/dir', './again': './src/index.js' })).toEqual([
      'libs/x/src/index.ts',
      'libs/x/src/dir/index.ts',
    ])
  })
})

describe('deriveLibraryFacts', () => {
  it('derives every name a core package is registered under', () => {
    expect(deriveLibraryFacts(TESTING)).toEqual({
      projectName: 'lib-testing',
      projectRoot: 'libs/testing',
      packageName: '@hyperfrontend/testing',
      libName: 'testing',
      description: 'Jest-style testing on node:test.',
      coverageFlag: 'testing',
      routeSlug: 'testing',
      manifestSlug: 'testing',
      pageSlug: 'testing',
      displayName: 'Testing',
      docsCategory: 'core',
      secondaryEntries: ['hooks', 'runner'],
      entryPoints: ['libs/testing/src/index.ts', 'libs/testing/src/runner/index.ts', 'libs/testing/src/hooks/index.ts'],
      hasArchitecture: true,
    })
  })

  it('derives the utility forms of the names and keeps a chosen section', () => {
    expect(
      deriveLibraryFacts({
        projectName: 'lib-json-utils',
        projectRoot: 'libs/utils/json',
        packageName: '@hyperfrontend/json-utils',
        description: '',
        tags: [],
        exports: {},
        docsCategory: 'supporting',
        hasArchitecture: false,
      })
    ).toEqual(
      expect.objectContaining({
        libName: 'json-utils',
        coverageFlag: 'json-utils',
        routeSlug: 'utils/json',
        manifestSlug: 'json-utils',
        pageSlug: 'json',
        displayName: 'Json Utils',
        docsCategory: 'supporting',
        secondaryEntries: [],
        entryPoints: [],
      })
    )
  })

  it('keeps an unscoped package name whole', () => {
    expect(deriveLibraryFacts({ ...TESTING, packageName: 'unscoped' })).toEqual(
      expect.objectContaining({ libName: 'unscoped', displayName: 'Unscoped' })
    )
  })
})
