import { describe, expect, it } from '@hyperfrontend/testing'
import { navigationEntry, registerLibraryInNavigation } from './docs-navigation'
import { deriveLibraryFacts } from './library-facts'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: '',
  tags: ['type:core'],
  exports: { '.': './src/index.js', './runner': './src/runner/index.js', './hooks': './src/hooks/index.js' },
  hasArchitecture: false,
})

const CORE = [
  'const coreLibraries: NavItem[] = [',
  "  { slug: 'builder', packageName: '@hyperfrontend/builder', href: '/docs/libraries/builder' },",
  '  {',
  "    slug: 'nexus',",
  "    packageName: '@hyperfrontend/nexus',",
  "    href: '/docs/libraries/nexus',",
  "    children: [{ slug: 'architecture', href: '/docs/libraries/nexus/architecture' }],",
  '  },',
  ']',
]

const SUPPORTING = [
  'const supportingLibraries: NavItem[] = [',
  "  { slug: 'logging', packageName: '@hyperfrontend/logging', href: '/docs/libraries/logging' },",
  "  { slug: 'questions', packageName: '@hyperfrontend/questions', href: '/docs/libraries/questions' },",
  ']',
]

const UTILS = [
  'const utilsLibraries: NavItem[] = [',
  "  { slug: 'data-utils', packageName: '@hyperfrontend/data-utils', href: '/docs/libraries/utils/data' },",
  ']',
]

const MODULE = [...CORE, '', ...SUPPORTING, '', ...UTILS, ''].join('\n')

const TESTING_ENTRY = [
  '  {',
  "    slug: 'testing',",
  "    packageName: '@hyperfrontend/testing',",
  "    href: '/docs/libraries/testing',",
  '    children: [',
  "      { slug: 'hooks', href: '/docs/libraries/testing/hooks' },",
  "      { slug: 'runner', href: '/docs/libraries/testing/runner' },",
  '    ],',
  '  },',
]

describe('registerLibraryInNavigation', () => {
  it('adds a core package where its slug sorts, with a child per secondary entry', () => {
    expect(registerLibraryInNavigation(MODULE, TESTING).split(/\r?\n/)).toEqual([
      ...CORE.slice(0, 8),
      ...TESTING_ENTRY,
      ...CORE.slice(8),
      '',
      ...SUPPORTING,
      '',
      ...UTILS,
      '',
    ])
  })

  it('adds a supporting package between the entries its slug sorts between', () => {
    const metrics = {
      ...TESTING,
      libName: 'metrics',
      packageName: '@hyperfrontend/metrics',
      routeSlug: 'metrics',
      docsCategory: 'supporting' as const,
      secondaryEntries: [],
    }
    expect(registerLibraryInNavigation(MODULE, metrics).split(/\r?\n/).slice(10, 14)).toEqual([
      ...SUPPORTING.slice(0, 2),
      "  { slug: 'metrics', packageName: '@hyperfrontend/metrics', href: '/docs/libraries/metrics' },",
      SUPPORTING[2],
    ])
  })

  it('adds a utility to the utilities under the utils route', () => {
    const facts = deriveLibraryFacts({
      projectName: 'lib-json-utils',
      projectRoot: 'libs/utils/json',
      packageName: '@hyperfrontend/json-utils',
      description: '',
      tags: [],
      exports: {},
      hasArchitecture: false,
    })
    expect(registerLibraryInNavigation(MODULE, facts).split(/\r?\n/).slice(16, 19)).toEqual([
      UTILS[1],
      "  { slug: 'json-utils', packageName: '@hyperfrontend/json-utils', href: '/docs/libraries/utils/json' },",
      ']',
    ])
  })

  it('changes nothing the second time', () => {
    const once = registerLibraryInNavigation(MODULE, TESTING)
    expect(registerLibraryInNavigation(once, TESTING)).toBe(once)
  })

  it('refuses a module without the array of the package section', () => {
    expect(() => registerLibraryInNavigation(SUPPORTING.join('\n'), TESTING)).toThrow(
      'navigation.ts coreLibraries: the block that opens it was not found'
    )
  })

  it('refuses an entry that declares no slug', () => {
    const slugless = ['const coreLibraries: NavItem[] = [', "  { packageName: '@hyperfrontend/builder' },", ']'].join('\n')
    expect(() => registerLibraryInNavigation(slugless, TESTING)).toThrow(
      "navigation.ts entry declares no slug: { packageName: '@hyperfrontend/builder' },"
    )
  })
})

describe('navigationEntry', () => {
  it('writes a package without children on one line', () => {
    expect(navigationEntry({ ...TESTING, secondaryEntries: [] })).toEqual([
      "  { slug: 'testing', packageName: '@hyperfrontend/testing', href: '/docs/libraries/testing' },",
    ])
  })

  it('breaks a package without children across lines when it would not fit the print width', () => {
    const long = 'a-package-whose-name-runs-on-and-on-past-the-width-the-formatter-wraps-at'
    expect(
      navigationEntry({ ...TESTING, secondaryEntries: [], libName: long, packageName: `@hyperfrontend/${long}`, routeSlug: long })
    ).toEqual(['  {', `    slug: '${long}',`, `    packageName: '@hyperfrontend/${long}',`, `    href: '/docs/libraries/${long}',`, '  },'])
  })

  it('lists the architecture document first and inlines it when it is the only child', () => {
    expect(navigationEntry({ ...TESTING, secondaryEntries: [], hasArchitecture: true })).toEqual([
      '  {',
      "    slug: 'testing',",
      "    packageName: '@hyperfrontend/testing',",
      "    href: '/docs/libraries/testing',",
      "    children: [{ slug: 'architecture', href: '/docs/libraries/testing/architecture' }],",
      '  },',
    ])
  })

  it('breaks a lone child onto its own line when it would not fit the print width', () => {
    const long = 'a-route-whose-name-runs-on-and-on-past-the-width-the-formatter-wraps-at-even-alone'
    expect(navigationEntry({ ...TESTING, secondaryEntries: ['runner'], routeSlug: long }).slice(4, 7)).toEqual([
      '    children: [',
      `      { slug: 'runner', href: '/docs/libraries/${long}/runner' },`,
      '    ],',
    ])
  })
})
