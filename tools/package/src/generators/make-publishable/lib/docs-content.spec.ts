import { describe, expect, it } from '@hyperfrontend/testing'
import { registerLibraryInContent } from './docs-content'
import { deriveLibraryFacts } from './library-facts'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: '',
  tags: ['type:core'],
  exports: { '.': './src/index.js', './runner': './src/runner/index.js', './package.json': './package.json' },
  hasArchitecture: true,
})

const MODULE = [
  'export const LIBRARIES: LibraryInfo[] = [',
  '  {',
  "    name: 'Nexus',",
  "    packageName: '@hyperfrontend/nexus',",
  "    slug: 'nexus',",
  "    readmePath: 'libs/nexus/README.md',",
  "    entryPoints: ['libs/nexus/src/index.ts'],",
  "    category: 'core',",
  '  },',
  ']',
  '',
].join('\n')

describe('registerLibraryInContent', () => {
  it('appends the library with its architecture document and entry points', () => {
    expect(registerLibraryInContent(MODULE, TESTING).split(/\r?\n/).slice(9, 19)).toEqual([
      '  {',
      "    name: 'Testing',",
      "    packageName: '@hyperfrontend/testing',",
      "    slug: 'testing',",
      "    readmePath: 'libs/testing/README.md',",
      "    architecturePath: 'libs/testing/ARCHITECTURE.md',",
      "    entryPoints: ['libs/testing/src/index.ts', 'libs/testing/src/runner/index.ts'],",
      "    category: 'core',",
      '  },',
      ']',
    ])
  })

  it('names no architecture document when the library has none', () => {
    expect(registerLibraryInContent(MODULE, { ...TESTING, hasArchitecture: false })).not.toContain('architecturePath')
  })

  it('lists the entry points one per line when they would not fit the print width', () => {
    const many = {
      ...TESTING,
      entryPoints: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => `libs/testing/src/${name.repeat(20)}/index.ts`),
    }
    expect(registerLibraryInContent(MODULE, many).split(/\r?\n/).slice(15, 25)).toEqual([
      '    entryPoints: [',
      ...many.entryPoints.map((entryPoint) => `      '${entryPoint}',`),
      '    ],',
      "    category: 'core',",
    ])
  })

  it('changes nothing the second time', () => {
    const once = registerLibraryInContent(MODULE, TESTING)
    expect(registerLibraryInContent(once, TESTING)).toBe(once)
  })

  it('refuses a module without the libraries', () => {
    expect(() => registerLibraryInContent('export const OTHER = []\n', TESTING)).toThrow(
      'content.ts LIBRARIES: the block that opens it was not found'
    )
  })
})
