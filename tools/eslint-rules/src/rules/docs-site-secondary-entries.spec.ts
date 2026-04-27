import type { ArrayExpression, Identifier, Literal, ObjectExpression, Property, SpreadElement } from 'estree'
import { RuleTester } from 'eslint'
import { createTempWorkspaceManager } from '../testing'
import rule, {
  RULE_NAME,
  extractLibraryEntries,
  extractSecondaryEntrySubpaths,
  getExpectedSecondaryNavHref,
  getExpectedSecondaryRouteDir,
} from './docs-site-secondary-entries'

const manager = createTempWorkspaceManager()

/**
 * Configuration for setting up a temp workspace for the rule.
 */
interface WorkspaceFixtureConfig {
  /** Library root paths to seed with package.json (relative to workspace root). */
  libraries?: Array<{
    /** Library root, e.g., 'libs/versioning'. */
    root: string
    /** Subpath keys to include in package.json exports map. */
    subpaths: string[]
    /** Override the entire `exports` value. When provided, `subpaths` is ignored. */
    rawExports?: unknown
  }>
  /** Page route directories to seed (relative to workspace root). */
  pageDirs?: string[]
  /** Hrefs to include in navigation.ts. Omit to skip writing navigation.ts. */
  navigationHrefs?: string[]
}

/**
 * Creates a temporary workspace seeded with library package.json files,
 * docs-site page.tsx files, and navigation.ts.
 *
 * @param config - The fixture configuration.
 * @returns The absolute workspace root path.
 */
function createTempWorkspace(config: WorkspaceFixtureConfig): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  if (config.libraries) {
    for (const library of config.libraries) {
      let exportsValue: unknown
      if (library.rawExports !== undefined) {
        exportsValue = library.rawExports
      } else {
        const exportsMap: Record<string, string> = {
          '.': './src/index.js',
        }
        for (const subpath of library.subpaths) {
          exportsMap[`./${subpath}`] = `./src/${subpath}/index.js`
        }
        exportsValue = exportsMap
      }
      const pkg: Record<string, unknown> = { name: `@hyperfrontend/${library.root.split('/').pop() ?? 'lib'}` }
      if (exportsValue !== null) {
        pkg.exports = exportsValue
      }
      files[`${library.root}/package.json`] = JSON.stringify(pkg, null, 2)
    }
  }

  if (config.pageDirs) {
    for (const dir of config.pageDirs) {
      files[`${dir}/page.tsx`] = 'export default function Page() { return null }'
    }
  }

  if (config.navigationHrefs !== undefined) {
    const hrefLines = config.navigationHrefs.map((href) => `  { href: '${href}' },`).join('\n')
    files['apps/docs-site/src/lib/navigation.ts'] = `export const docsNavigation = [\n${hrefLines}\n]\n`
  }

  const workspace = manager.create({
    files,
    directories: ['apps/docs-site/src/lib'],
  })
  return workspace.root
}

/**
 * Creates content.ts code that defines the LIBRARIES array.
 *
 * @param libraries - Array of library config objects.
 * @returns JavaScript code for content.ts.
 */
function createContentTsCode(
  libraries: Array<{
    name: string
    slug: string
    category: 'core' | 'supporting' | 'utils' | 'plugin'
    readmePath: string
  }>
): string {
  const libraryEntries = libraries
    .map(
      (lib) => `  {
    name: '${lib.name}',
    packageName: '@hyperfrontend/${lib.slug.replace('/', '-')}',
    slug: '${lib.slug}',
    readmePath: '${lib.readmePath}',
    entryPoints: ['${lib.readmePath.replace('README.md', 'src/index.ts')}'],
    category: '${lib.category}',
  }`
    )
    .join(',\n')

  return `export const LIBRARIES = [
${libraryEntries}
]
`
}

describe('docs-site-secondary-entries', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('docs-site-secondary-entries')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('docs-site-secondary-entries')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingSecondaryRoute')
      expect(messageIds).toContain('missingSecondaryNavigation')
    })
  })

  describe('getExpectedSecondaryRouteDir', () => {
    it('returns libraries path for core category', () => {
      expect(getExpectedSecondaryRouteDir('nexus', 'core', 'sub')).toBe('apps/docs-site/src/app/docs/libraries/nexus/sub')
    })

    it('returns libraries path for supporting category', () => {
      expect(getExpectedSecondaryRouteDir('versioning', 'supporting', 'commits/parse')).toBe(
        'apps/docs-site/src/app/docs/libraries/versioning/commits/parse'
      )
    })

    it('returns libraries path for utils category', () => {
      expect(getExpectedSecondaryRouteDir('utils/data', 'utils', 'core')).toBe('apps/docs-site/src/app/docs/libraries/utils/data/core')
    })

    it('returns plugins path for plugin category', () => {
      expect(getExpectedSecondaryRouteDir('features', 'plugin', 'core')).toBe('apps/docs-site/src/app/docs/plugins/features/core')
    })
  })

  describe('getExpectedSecondaryNavHref', () => {
    it('returns /docs/libraries href for core category', () => {
      expect(getExpectedSecondaryNavHref('nexus', 'core', 'sub')).toBe("href: '/docs/libraries/nexus/sub'")
    })

    it('returns /docs/libraries href for supporting category', () => {
      expect(getExpectedSecondaryNavHref('versioning', 'supporting', 'commits/parse')).toBe(
        "href: '/docs/libraries/versioning/commits/parse'"
      )
    })

    it('returns /docs/libraries href for utils category', () => {
      expect(getExpectedSecondaryNavHref('utils/data', 'utils', 'core')).toBe("href: '/docs/libraries/utils/data/core'")
    })

    it('returns /docs/plugins href for plugin category', () => {
      expect(getExpectedSecondaryNavHref('features', 'plugin', 'core')).toBe("href: '/docs/plugins/features/core'")
    })
  })

  describe('extractSecondaryEntrySubpaths', () => {
    it('returns empty array for null package.json', () => {
      expect(extractSecondaryEntrySubpaths(null)).toEqual([])
    })

    it('returns empty array when exports is missing', () => {
      expect(extractSecondaryEntrySubpaths({})).toEqual([])
    })

    it('returns empty array when exports is a string', () => {
      expect(extractSecondaryEntrySubpaths({ exports: './src/index.js' })).toEqual([])
    })

    it('skips primary entrypoint and package.json re-export', () => {
      expect(
        extractSecondaryEntrySubpaths({
          exports: {
            '.': './src/index.js',
            './package.json': './package.json',
          },
        })
      ).toEqual([])
    })

    it('extracts simple secondary entrypoints', () => {
      expect(
        extractSecondaryEntrySubpaths({
          exports: {
            '.': './src/index.js',
            './foo': './src/foo/index.js',
            './bar': './src/bar/index.js',
          },
        })
      ).toEqual(['foo', 'bar'])
    })

    it('extracts nested secondary entrypoints', () => {
      expect(
        extractSecondaryEntrySubpaths({
          exports: {
            './commits/parse': './src/commits/parse/index.js',
            './commits/classify': './src/commits/classify/index.js',
          },
        })
      ).toEqual(['commits/parse', 'commits/classify'])
    })

    it('skips glob entries', () => {
      expect(
        extractSecondaryEntrySubpaths({
          exports: {
            './*': './src/*.js',
            './foo/*': './src/foo/*.js',
            './bar': './src/bar/index.js',
          },
        })
      ).toEqual(['bar'])
    })

    it('skips keys without leading ./', () => {
      expect(
        extractSecondaryEntrySubpaths({
          exports: {
            foo: './src/foo/index.js',
            './bar': './src/bar/index.js',
          },
        })
      ).toEqual(['bar'])
    })
  })

  describe('extractLibraryEntries', () => {
    /**
     * Creates a mock library object expression for testing.
     *
     * @param config - The library configuration containing name, slug, readmePath, and category.
     * @param config.name - The display name of the library.
     * @param config.slug - The slug for the library route.
     * @param config.readmePath - The README path used to derive the library root.
     * @param config.category - The category of the library (core, supporting, utils, plugin).
     * @returns An ObjectExpression AST node.
     */
    function createMockLibraryObject(config: { name?: string; slug?: string; readmePath?: string; category?: string }): ObjectExpression {
      const properties: Property[] = []

      if (config.name !== undefined) {
        properties.push({
          type: 'Property',
          key: { type: 'Identifier', name: 'name' } as Identifier,
          value: { type: 'Literal', value: config.name } as Literal,
          kind: 'init',
          method: false,
          shorthand: false,
          computed: false,
        })
      }

      if (config.slug !== undefined) {
        properties.push({
          type: 'Property',
          key: { type: 'Identifier', name: 'slug' } as Identifier,
          value: { type: 'Literal', value: config.slug } as Literal,
          kind: 'init',
          method: false,
          shorthand: false,
          computed: false,
        })
      }

      if (config.readmePath !== undefined) {
        properties.push({
          type: 'Property',
          key: { type: 'Identifier', name: 'readmePath' } as Identifier,
          value: { type: 'Literal', value: config.readmePath } as Literal,
          kind: 'init',
          method: false,
          shorthand: false,
          computed: false,
        })
      }

      if (config.category !== undefined) {
        properties.push({
          type: 'Property',
          key: { type: 'Identifier', name: 'category' } as Identifier,
          value: { type: 'Literal', value: config.category } as Literal,
          kind: 'init',
          method: false,
          shorthand: false,
          computed: false,
        })
      }

      return {
        type: 'ObjectExpression',
        properties,
      }
    }

    it('extracts library entries from array expression', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          createMockLibraryObject({ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' }),
          createMockLibraryObject({
            name: 'Versioning',
            slug: 'versioning',
            readmePath: 'libs/versioning/README.md',
            category: 'supporting',
          }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([
        expect.objectContaining({ name: 'Nexus', slug: 'nexus', libraryRoot: 'libs/nexus', category: 'core' }),
        expect.objectContaining({ name: 'Versioning', slug: 'versioning', libraryRoot: 'libs/versioning', category: 'supporting' }),
      ])
    })

    it('handles empty array', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('ignores non-object elements', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 'not-an-object' } as Literal,
          createMockLibraryObject({ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([expect.objectContaining({ slug: 'nexus' })])
    })

    it('ignores null elements', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [null, createMockLibraryObject({ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' })],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(1)
    })

    it('ignores entries missing slug', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', readmePath: 'libs/nexus/README.md', category: 'core' })],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('ignores entries missing category', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md' })],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('ignores entries missing name', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' })],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('ignores entries missing readmePath', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', slug: 'nexus', category: 'core' })],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('handles string literal property keys', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Literal', value: 'name' } as Literal,
                value: { type: 'Literal', value: 'Nexus' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Literal', value: 'slug' } as Literal,
                value: { type: 'Literal', value: 'nexus' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Literal', value: 'readmePath' } as Literal,
                value: { type: 'Literal', value: 'libs/nexus/README.md' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Literal', value: 'category' } as Literal,
                value: { type: 'Literal', value: 'core' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
            ],
          } as ObjectExpression,
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([expect.objectContaining({ slug: 'nexus' })])
    })

    it('handles non-identifier non-literal keys', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Literal', value: 123 } as Literal,
                value: { type: 'Literal', value: 'value' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
            ],
          } as ObjectExpression,
        ],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })

    it('ignores spread elements in properties', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'SpreadElement',
                argument: { type: 'Identifier', name: 'otherProps' },
              } as SpreadElement,
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'name' } as Identifier,
                value: { type: 'Literal', value: 'Nexus' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'slug' } as Identifier,
                value: { type: 'Literal', value: 'nexus' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'readmePath' } as Identifier,
                value: { type: 'Literal', value: 'libs/nexus/README.md' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'category' } as Identifier,
                value: { type: 'Literal', value: 'core' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
            ],
          } as ObjectExpression,
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([expect.objectContaining({ slug: 'nexus' })])
    })

    it('ignores non-string property values', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'name' } as Identifier,
                value: { type: 'Literal', value: 'Nexus' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'slug' } as Identifier,
                value: { type: 'Literal', value: 42 } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'readmePath' } as Identifier,
                value: { type: 'Literal', value: 'libs/nexus/README.md' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'category' } as Identifier,
                value: { type: 'Literal', value: 'core' } as Literal,
                kind: 'init',
                method: false,
                shorthand: false,
                computed: false,
              },
            ],
          } as ObjectExpression,
        ],
      }

      expect(extractLibraryEntries(arrayNode)).toHaveLength(0)
    })
  })

  describe('RuleTester', () => {
    const ruleTester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    })

    ruleTester.run('docs-site-secondary-entries', rule, {
      valid: [
        {
          name: 'ignores non-content.ts files',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/docs-site/src/lib/other-file.ts`
          })(),
        },
        {
          name: 'ignores files outside docs-site/src/lib path',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/other-app/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores files in shallow paths',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/content.ts`
          })(),
        },
        {
          name: 'ignores non-exported LIBRARIES',
          code: `const LIBRARIES = [
  {
    name: 'Versioning',
    slug: 'versioning',
    readmePath: 'libs/versioning/README.md',
    category: 'supporting',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores let declarations',
          code: `export let LIBRARIES = [
  {
    name: 'Versioning',
    slug: 'versioning',
    readmePath: 'libs/versioning/README.md',
    category: 'supporting',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores non-LIBRARIES constants',
          code: `export const OTHER_ARRAY = [
  {
    name: 'Versioning',
    slug: 'versioning',
    readmePath: 'libs/versioning/README.md',
    category: 'supporting',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores non-array LIBRARIES',
          code: `export const LIBRARIES = 'not-an-array'`,
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when library has no package.json',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when package.json has no exports',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: [], rawExports: null }],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when package.json exports is a string',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: [], rawExports: './src/index.js' }],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when only primary entry and package.json re-export are declared',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [
                {
                  root: 'libs/versioning',
                  subpaths: [],
                  rawExports: { '.': './src/index.js', './package.json': './package.json' },
                },
              ],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when all secondary entries have routes and nav links',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse', 'semver/format'] }],
              pageDirs: [
                'apps/docs-site/src/app/docs/libraries/versioning/commits/parse',
                'apps/docs-site/src/app/docs/libraries/versioning/semver/format',
              ],
              navigationHrefs: ['/docs/libraries/versioning/commits/parse', '/docs/libraries/versioning/semver/format'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes for plugin secondary entries',
          code: createContentTsCode([
            { name: 'Features Plugin', slug: 'features', readmePath: 'plugins/features/README.md', category: 'plugin' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'plugins/features', subpaths: ['core'] }],
              pageDirs: ['apps/docs-site/src/app/docs/plugins/features/core'],
              navigationHrefs: ['/docs/plugins/features/core'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'skips glob entries when validating',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [
                {
                  root: 'libs/versioning',
                  subpaths: [],
                  rawExports: {
                    '.': './src/index.js',
                    './*': './src/*.js',
                  },
                },
              ],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'skips navigation check when navigation.ts is missing',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
              pageDirs: ['apps/docs-site/src/app/docs/libraries/versioning/commits/parse'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
      ],
      invalid: [
        {
          name: 'reports missing route for secondary entry',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
              pageDirs: [],
              navigationHrefs: ['/docs/libraries/versioning/commits/parse'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingSecondaryRoute',
              data: {
                name: 'Versioning',
                subpath: 'commits/parse',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports missing navigation entry for secondary entry',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
              pageDirs: ['apps/docs-site/src/app/docs/libraries/versioning/commits/parse'],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingSecondaryNavigation',
              data: {
                name: 'Versioning',
                subpath: 'commits/parse',
                expectedHref: "href: '/docs/libraries/versioning/commits/parse'",
              },
            },
          ],
        },
        {
          name: 'reports both missing route and navigation for the same entry',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'libs/versioning', subpaths: ['commits/parse'] }],
              pageDirs: [],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingSecondaryRoute',
              data: {
                name: 'Versioning',
                subpath: 'commits/parse',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx',
              },
            },
            {
              messageId: 'missingSecondaryNavigation',
              data: {
                name: 'Versioning',
                subpath: 'commits/parse',
                expectedHref: "href: '/docs/libraries/versioning/commits/parse'",
              },
            },
          ],
        },
        {
          name: 'reports for plugin secondary entries',
          code: createContentTsCode([
            { name: 'Features Plugin', slug: 'features', readmePath: 'plugins/features/README.md', category: 'plugin' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [{ root: 'plugins/features', subpaths: ['core'] }],
              pageDirs: [],
              navigationHrefs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingSecondaryRoute',
              data: {
                name: 'Features Plugin',
                subpath: 'core',
                expectedPath: 'apps/docs-site/src/app/docs/plugins/features/core/page.tsx',
              },
            },
            {
              messageId: 'missingSecondaryNavigation',
              data: {
                name: 'Features Plugin',
                subpath: 'core',
                expectedHref: "href: '/docs/plugins/features/core'",
              },
            },
          ],
        },
        {
          name: 'reports across multiple libraries and multiple subpaths',
          code: createContentTsCode([
            { name: 'Versioning', slug: 'versioning', readmePath: 'libs/versioning/README.md', category: 'supporting' },
            { name: 'Nexus', slug: 'nexus', readmePath: 'libs/nexus/README.md', category: 'core' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              libraries: [
                { root: 'libs/versioning', subpaths: ['commits/parse', 'semver/format'] },
                { root: 'libs/nexus', subpaths: ['core'] },
              ],
              pageDirs: ['apps/docs-site/src/app/docs/libraries/versioning/commits/parse'],
              navigationHrefs: ['/docs/libraries/versioning/commits/parse'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingSecondaryRoute',
              data: {
                name: 'Versioning',
                subpath: 'semver/format',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/versioning/semver/format/page.tsx',
              },
            },
            {
              messageId: 'missingSecondaryNavigation',
              data: {
                name: 'Versioning',
                subpath: 'semver/format',
                expectedHref: "href: '/docs/libraries/versioning/semver/format'",
              },
            },
            {
              messageId: 'missingSecondaryRoute',
              data: {
                name: 'Nexus',
                subpath: 'core',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/nexus/core/page.tsx',
              },
            },
            {
              messageId: 'missingSecondaryNavigation',
              data: {
                name: 'Nexus',
                subpath: 'core',
                expectedHref: "href: '/docs/libraries/nexus/core'",
              },
            },
          ],
        },
      ],
    })
  })
})
