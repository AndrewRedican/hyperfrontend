import type { ArrayExpression, Identifier, Literal, ObjectExpression, Property, SpreadElement } from 'estree'
import { RuleTester } from 'eslint'
import { createTempWorkspaceManager } from '../testing'
import rule, { RULE_NAME, extractLibraryEntries, getExpectedRouteDir, getExpectedNavHref } from './docs-site-routes'

const manager = createTempWorkspaceManager()

/**
 * Creates a temporary workspace structure with docs-site routes.
 *
 * @param config - Configuration for the workspace.
 * @param config.routes - Array of route slugs to create with page.tsx files.
 * @param config.pluginRoutes - Array of plugin route slugs to create with page.tsx files.
 * @param config.navigationHrefs - Hrefs to include in navigation.ts. Omit to skip navigation check.
 * @param config.generateDocsPackageNames - Package names to include in generate-docs.ts LIBRARIES. Omit to skip check.
 * @param config.librarySlugs - Slugs to include in generate-docs.ts LIBRARY_SLUGS. Omit to skip check.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: {
  routes?: string[]
  pluginRoutes?: string[]
  navigationHrefs?: string[]
  generateDocsPackageNames?: string[]
  librarySlugs?: string[]
}): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  if (config.routes && config.routes.length > 0) {
    for (const route of config.routes) {
      files[`apps/docs-site/src/app/docs/libraries/${route}/page.tsx`] = 'export default function Page() { return null }'
    }
  }

  if (config.pluginRoutes && config.pluginRoutes.length > 0) {
    for (const route of config.pluginRoutes) {
      files[`apps/docs-site/src/app/docs/plugins/${route}/page.tsx`] = 'export default function Page() { return null }'
    }
  }

  if (config.navigationHrefs !== undefined) {
    const hrefLines = config.navigationHrefs.map((href) => `  { href: '${href}' },`).join('\n')
    files['apps/docs-site/src/lib/navigation.ts'] = `export const docsNavigation = [\n${hrefLines}\n]\n`
  }

  if (config.generateDocsPackageNames !== undefined || config.librarySlugs !== undefined) {
    const packageNameLines = (config.generateDocsPackageNames ?? []).map((pn) => `  { packageName: '${pn}' },`).join('\n')
    const slugLines = (config.librarySlugs ?? []).map((s) => (s.includes('-') ? `  '${s}': '${s}',` : `  ${s}: '${s}',`)).join('\n')
    files['apps/docs-site/scripts/generate-docs.ts'] =
      `const LIBRARIES = [\n${packageNameLines}\n]\nconst LIBRARY_SLUGS = {\n${slugLines}\n}\n`
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
  }>
): string {
  const libraryEntries = libraries
    .map(
      (lib) => `  {
    name: '${lib.name}',
    packageName: '@hyperfrontend/${lib.slug.replace('/', '-')}',
    slug: '${lib.slug}',
    readmePath: 'libs/${lib.slug}/README.md',
    entryPoints: ['libs/${lib.slug}/src/index.ts'],
    category: '${lib.category}',
  }`
    )
    .join(',\n')

  return `export const LIBRARIES = [
${libraryEntries}
]
`
}

describe('docs-site-routes', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('docs-site-routes')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('docs-site-routes')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingRoute')
      expect(messageIds).toContain('missingNavigation')
      expect(messageIds).toContain('missingGenerateDocs')
      expect(messageIds).toContain('missingLibrarySlug')
    })
  })

  describe('getExpectedRouteDir', () => {
    it('returns libraries path for core category', () => {
      const result = getExpectedRouteDir('nexus', 'core')
      expect(result).toBe('apps/docs-site/src/app/docs/libraries/nexus')
    })

    it('returns libraries path for supporting category', () => {
      const result = getExpectedRouteDir('logging', 'supporting')
      expect(result).toBe('apps/docs-site/src/app/docs/libraries/logging')
    })

    it('returns libraries path for utils category', () => {
      const result = getExpectedRouteDir('utils/data', 'utils')
      expect(result).toBe('apps/docs-site/src/app/docs/libraries/utils/data')
    })

    it('returns plugins path for plugin category', () => {
      const result = getExpectedRouteDir('features', 'plugin')
      expect(result).toBe('apps/docs-site/src/app/docs/plugins/features')
    })
  })

  describe('getExpectedNavHref', () => {
    it('returns /docs/libraries href for core category', () => {
      expect(getExpectedNavHref('nexus', 'core')).toBe("href: '/docs/libraries/nexus'")
    })

    it('returns /docs/libraries href for supporting category', () => {
      expect(getExpectedNavHref('questions', 'supporting')).toBe("href: '/docs/libraries/questions'")
    })

    it('returns /docs/libraries href for utils category', () => {
      expect(getExpectedNavHref('utils/data', 'utils')).toBe("href: '/docs/libraries/utils/data'")
    })

    it('returns /docs/plugins href for plugin category', () => {
      expect(getExpectedNavHref('features', 'plugin')).toBe("href: '/docs/plugins/features'")
    })
  })

  describe('extractLibraryEntries', () => {
    /**
     * Creates a mock library object expression for testing.
     *
     * @param config - The library configuration containing name, slug, packageName, and category.
     * @param config.name - The display name of the library.
     * @param config.slug - The slug for the library route.
     * @param config.packageName - The npm package name.
     * @param config.category - The category of the library (core, supporting, utils, plugin).
     *
     * @returns An ObjectExpression AST node.
     */
    function createMockLibraryObject(config: { name?: string; slug?: string; packageName?: string; category?: string }): ObjectExpression {
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

      if (config.packageName !== undefined) {
        properties.push({
          type: 'Property',
          key: { type: 'Identifier', name: 'packageName' } as Identifier,
          value: { type: 'Literal', value: config.packageName } as Literal,
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
          createMockLibraryObject({ name: 'Nexus', slug: 'nexus', category: 'core' }),
          createMockLibraryObject({ name: 'Logging', slug: 'logging', category: 'supporting' }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([
        expect.objectContaining({ slug: 'nexus', category: 'core', name: 'Nexus' }),
        expect.objectContaining({ slug: 'logging', category: 'supporting' }),
      ])
    })

    it('extracts packageName when present', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', slug: 'nexus', packageName: '@hyperfrontend/nexus', category: 'core' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([expect.objectContaining({ packageName: '@hyperfrontend/nexus' })])
    })

    it('sets packageName to undefined when absent', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', slug: 'nexus', category: 'core' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result[0].packageName).toBeUndefined()
    })

    it('handles empty array', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
    })

    it('ignores non-object elements', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 'not-an-object' } as Literal,
          createMockLibraryObject({ name: 'Nexus', slug: 'nexus', category: 'core' }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([expect.objectContaining({ slug: 'nexus' })])
    })

    it('ignores null elements', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [null, createMockLibraryObject({ name: 'Nexus', slug: 'nexus', category: 'core' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
    })

    it('ignores entries missing slug', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', category: 'core' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
    })

    it('ignores entries missing category', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ name: 'Nexus', slug: 'nexus' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
    })

    it('ignores entries missing name', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [createMockLibraryObject({ slug: 'nexus', category: 'core' })],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
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

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
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
      expect(result).toHaveLength(0)
    })
  })

  describe('RuleTester', () => {
    const ruleTester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    })

    ruleTester.run('docs-site-routes', rule, {
      valid: [
        {
          name: 'ignores non-content.ts files',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/docs-site/src/lib/other-file.ts`
          })(),
        },
        {
          name: 'ignores non-exported LIBRARIES',
          code: `const LIBRARIES = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores let declarations',
          code: `export let LIBRARIES = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores non-LIBRARIES constants',
          code: `export const OTHER_ARRAY = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const dir = createTempWorkspace({})
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
          name: 'passes when all routes exist for libraries',
          code: createContentTsCode([
            { name: 'Nexus', slug: 'nexus', category: 'core' },
            { name: 'Logging', slug: 'logging', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({ routes: ['nexus', 'logging'] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when all routes exist for plugins',
          code: createContentTsCode([{ name: 'Features Plugin', slug: 'features', category: 'plugin' }]),
          filename: (() => {
            const dir = createTempWorkspace({ pluginRoutes: ['features'] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when nested routes exist',
          code: createContentTsCode([
            { name: 'Data Utils', slug: 'utils/data', category: 'utils' },
            { name: 'String Utils', slug: 'utils/string', category: 'utils' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({ routes: ['utils/data', 'utils/string'] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores files outside docs-site/src/lib path',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/apps/other-app/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores files in shallow paths',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({})
            return `${dir}/content.ts`
          })(),
        },
        {
          name: 'passes all checks when navigation and generate-docs files are present and complete',
          code: createContentTsCode([
            { name: 'Nexus', slug: 'nexus', category: 'core' },
            { name: 'Questions', slug: 'questions', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['nexus', 'questions'],
              navigationHrefs: ['/docs/libraries/nexus', '/docs/libraries/questions'],
              generateDocsPackageNames: ['@hyperfrontend/nexus', '@hyperfrontend/questions'],
              librarySlugs: ['nexus', 'questions'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes all checks for plugin with navigation and generate-docs',
          code: createContentTsCode([{ name: 'Features Plugin', slug: 'features', category: 'plugin' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              pluginRoutes: ['features'],
              navigationHrefs: ['/docs/plugins/features'],
              generateDocsPackageNames: ['@hyperfrontend/features'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes all checks for utils libraries (no LIBRARY_SLUGS required)',
          code: createContentTsCode([{ name: 'Data Utils', slug: 'utils/data', category: 'utils' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['utils/data'],
              navigationHrefs: ['/docs/libraries/utils/data'],
              generateDocsPackageNames: ['@hyperfrontend/utils-data'],
              librarySlugs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes LIBRARY_SLUGS check for hyphenated slug',
          code: createContentTsCode([{ name: 'State Machine', slug: 'state-machine', category: 'supporting' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['state-machine'],
              navigationHrefs: ['/docs/libraries/state-machine'],
              generateDocsPackageNames: ['@hyperfrontend/state-machine'],
              librarySlugs: ['state-machine'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
        },
      ],
      invalid: [
        {
          name: 'reports error when library route is missing',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({ routes: [] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingRoute',
              data: {
                name: 'Nexus',
                slug: 'nexus',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/nexus/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports error when plugin route is missing',
          code: createContentTsCode([{ name: 'Features Plugin', slug: 'features', category: 'plugin' }]),
          filename: (() => {
            const dir = createTempWorkspace({ pluginRoutes: [] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingRoute',
              data: {
                name: 'Features Plugin',
                slug: 'features',
                expectedPath: 'apps/docs-site/src/app/docs/plugins/features/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports multiple errors for multiple missing routes',
          code: createContentTsCode([
            { name: 'Nexus', slug: 'nexus', category: 'core' },
            { name: 'Logging', slug: 'logging', category: 'supporting' },
            { name: 'State Machine', slug: 'state-machine', category: 'supporting' },
          ]),
          filename: (() => {
            const dir = createTempWorkspace({ routes: ['nexus'] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingRoute',
              data: {
                name: 'Logging',
                slug: 'logging',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/logging/page.tsx',
              },
            },
            {
              messageId: 'missingRoute',
              data: {
                name: 'State Machine',
                slug: 'state-machine',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/state-machine/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports error when nested route is missing',
          code: createContentTsCode([{ name: 'Data Utils', slug: 'utils/data', category: 'utils' }]),
          filename: (() => {
            const dir = createTempWorkspace({ routes: [] })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingRoute',
              data: {
                name: 'Data Utils',
                slug: 'utils/data',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/utils/data/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports error when navigation entry is missing for core library',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['nexus'],
              navigationHrefs: [],
              generateDocsPackageNames: ['@hyperfrontend/nexus'],
              librarySlugs: ['nexus'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingNavigation',
              data: {
                name: 'Nexus',
                slug: 'nexus',
                expectedHref: "href: '/docs/libraries/nexus'",
              },
            },
          ],
        },
        {
          name: 'reports error when navigation entry is missing for supporting library',
          code: createContentTsCode([{ name: 'Questions', slug: 'questions', category: 'supporting' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['questions'],
              navigationHrefs: [],
              generateDocsPackageNames: ['@hyperfrontend/questions'],
              librarySlugs: ['questions'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingNavigation',
              data: {
                name: 'Questions',
                slug: 'questions',
                expectedHref: "href: '/docs/libraries/questions'",
              },
            },
          ],
        },
        {
          name: 'reports error when navigation entry is missing for plugin',
          code: createContentTsCode([{ name: 'Features Plugin', slug: 'features', category: 'plugin' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              pluginRoutes: ['features'],
              navigationHrefs: [],
              generateDocsPackageNames: ['@hyperfrontend/features'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingNavigation',
              data: {
                name: 'Features Plugin',
                slug: 'features',
                expectedHref: "href: '/docs/plugins/features'",
              },
            },
          ],
        },
        {
          name: 'reports error when generate-docs LIBRARIES entry is missing',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['nexus'],
              navigationHrefs: ['/docs/libraries/nexus'],
              generateDocsPackageNames: [],
              librarySlugs: ['nexus'],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingGenerateDocs',
              data: {
                name: 'Nexus',
                slug: 'nexus',
              },
            },
          ],
        },
        {
          name: 'reports error when LIBRARY_SLUGS entry is missing for core library',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', category: 'core' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['nexus'],
              navigationHrefs: ['/docs/libraries/nexus'],
              generateDocsPackageNames: ['@hyperfrontend/nexus'],
              librarySlugs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingLibrarySlug',
              data: {
                name: 'Nexus',
                slug: 'nexus',
              },
            },
          ],
        },
        {
          name: 'reports error when LIBRARY_SLUGS entry is missing for supporting library',
          code: createContentTsCode([{ name: 'Questions', slug: 'questions', category: 'supporting' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['questions'],
              navigationHrefs: ['/docs/libraries/questions'],
              generateDocsPackageNames: ['@hyperfrontend/questions'],
              librarySlugs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingLibrarySlug',
              data: {
                name: 'Questions',
                slug: 'questions',
              },
            },
          ],
        },
        {
          name: 'reports error when LIBRARY_SLUGS entry is missing for hyphenated slug',
          code: createContentTsCode([{ name: 'State Machine', slug: 'state-machine', category: 'supporting' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: ['state-machine'],
              navigationHrefs: ['/docs/libraries/state-machine'],
              generateDocsPackageNames: ['@hyperfrontend/state-machine'],
              librarySlugs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingLibrarySlug',
              data: {
                name: 'State Machine',
                slug: 'state-machine',
              },
            },
          ],
        },
        {
          name: 'does not require LIBRARY_SLUGS for utils libraries',
          code: createContentTsCode([{ name: 'Data Utils', slug: 'utils/data', category: 'utils' }]),
          filename: (() => {
            const dir = createTempWorkspace({
              routes: [],
              navigationHrefs: ['/docs/libraries/utils/data'],
              generateDocsPackageNames: ['@hyperfrontend/utils-data'],
              librarySlugs: [],
            })
            return `${dir}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingRoute',
              data: {
                name: 'Data Utils',
                slug: 'utils/data',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/utils/data/page.tsx',
              },
            },
          ],
        },
      ],
    })
  })
})
