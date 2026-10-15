import { describe, expect, it } from '@hyperfrontend/testing'
import { registerLibraryInGenerateDocs } from './docs-generate-config'
import { deriveLibraryFacts } from './library-facts'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: '',
  tags: ['type:core'],
  exports: {},
  hasArchitecture: false,
})

const JSON_UTILS = deriveLibraryFacts({
  projectName: 'lib-json-utils',
  projectRoot: 'libs/utils/json',
  packageName: '@hyperfrontend/json-utils',
  description: '',
  tags: [],
  exports: {},
  hasArchitecture: false,
})

const SCRIPT = [
  'const LIBRARIES: LibraryConfig[] = [',
  "  { name: 'Nexus', packageName: '@hyperfrontend/nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' },",
  ']',
  '',
  'const LIBRARY_SLUGS: Record<string, string> = {',
  "  nexus: 'nexus',",
  "  'network-protocol': 'network-protocol',",
  '}',
  '',
].join('\n')

const TESTING_ENTRY =
  "  { name: 'Testing', packageName: '@hyperfrontend/testing', slug: 'testing', srcPath: 'libs/testing', category: 'core' },"

describe('registerLibraryInGenerateDocs', () => {
  it('appends a core package to the libraries and its slug to the link map', () => {
    expect(registerLibraryInGenerateDocs(SCRIPT, TESTING).split(/\r?\n/)).toEqual([
      'const LIBRARIES: LibraryConfig[] = [',
      "  { name: 'Nexus', packageName: '@hyperfrontend/nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' },",
      TESTING_ENTRY,
      ']',
      '',
      'const LIBRARY_SLUGS: Record<string, string> = {',
      "  nexus: 'nexus',",
      "  'network-protocol': 'network-protocol',",
      "  testing: 'testing',",
      '}',
      '',
    ])
  })

  it('quotes a hyphenated slug key', () => {
    const facts = { ...TESTING, routeSlug: 'network-protocol-v2', manifestSlug: 'network-protocol-v2' }
    expect(registerLibraryInGenerateDocs(SCRIPT, facts)).toContain("  'network-protocol-v2': 'network-protocol-v2',\n}")
  })

  it('lists a utility by its manifest slug and adds no link slug for it', () => {
    const updated = registerLibraryInGenerateDocs(SCRIPT, JSON_UTILS)
    expect({ entry: updated.split(/\r?\n/)[2], slugs: updated.split(/\r?\n/).slice(5, 9) }).toEqual({
      entry:
        "  { name: 'Json Utils', packageName: '@hyperfrontend/json-utils', slug: 'json-utils', srcPath: 'libs/utils/json', category: 'utils' },",
      slugs: ['const LIBRARY_SLUGS: Record<string, string> = {', "  nexus: 'nexus',", "  'network-protocol': 'network-protocol',", '}'],
    })
  })

  it('breaks an entry across lines when it would not fit the print width', () => {
    const wide = { ...TESTING, displayName: 'A Package With A Name Long Enough To Push The Entry Past The Width The Formatter Wraps At' }
    expect(registerLibraryInGenerateDocs(SCRIPT, wide).split(/\r?\n/).slice(2, 9)).toEqual([
      '  {',
      "    name: 'A Package With A Name Long Enough To Push The Entry Past The Width The Formatter Wraps At',",
      "    packageName: '@hyperfrontend/testing',",
      "    slug: 'testing',",
      "    srcPath: 'libs/testing',",
      "    category: 'core',",
      '  },',
    ])
  })

  it('changes nothing the second time', () => {
    const once = registerLibraryInGenerateDocs(SCRIPT, TESTING)
    expect(registerLibraryInGenerateDocs(once, TESTING)).toBe(once)
  })

  it('adds the slug when only the entry is there', () => {
    const listed = SCRIPT.replace('\n]', `\n${TESTING_ENTRY}\n]`)
    expect(registerLibraryInGenerateDocs(listed, TESTING)).toBe(listed.replace('\n}', "\n  testing: 'testing',\n}"))
  })

  it('refuses a script without the libraries', () => {
    expect(() => registerLibraryInGenerateDocs('const OTHER = []\n', TESTING)).toThrow(
      'generate-docs.ts LIBRARIES: the block that opens it was not found'
    )
  })
})
