import type { ArrayExpression, Identifier, Literal, ObjectExpression, Property } from 'estree'
import { after as afterAll } from 'node:test'
import { RuleTester } from 'eslint'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, {
  RULE_NAME,
  extractLibraryEntries,
  computeRouteSlugFromDir,
  computeRouteSlugFromFile,
  getExpectedPagePath,
  getLibraryMarkdownFiles,
} from './docs-site-library-docs'

const manager = createTempWorkspaceManager()

/**
 * Creates a temporary workspace with library markdown files and optional docs-site pages.
 *
 * @param config - Configuration for the workspace.
 * @param config.libraries - Array of libraries with their markdown files.
 * @param config.existingPages - Array of docs-site page paths that exist.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: {
  libraries: Array<{
    slug: string
    category: 'core' | 'supporting' | 'utils' | 'plugin'
    srcPath: string
    markdownFiles: string[]
  }>
  existingPages?: string[]
}): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  for (const lib of config.libraries) {
    files[`${lib.srcPath}/project.json`] = JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }, null, 2)
    files[`${lib.srcPath}/package.json`] = JSON.stringify({ name: `@hyperfrontend/${lib.slug.replace('/', '-')}` }, null, 2)

    for (const mdFile of lib.markdownFiles) {
      files[`${lib.srcPath}/${mdFile}`] = `# ${mdFile}`
    }
  }

  if (config.existingPages) {
    for (const page of config.existingPages) {
      files[page] = 'export default function Page() { return null }'
    }
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
    srcPath: string
    category: 'core' | 'supporting' | 'utils' | 'plugin'
  }>
): string {
  const libraryEntries = libraries
    .map(
      (lib) => `  {
    name: '${lib.name}',
    packageName: '@hyperfrontend/${lib.slug.replace('/', '-')}',
    slug: '${lib.slug}',
    readmePath: '${lib.srcPath}/README.md',
    entryPoints: ['${lib.srcPath}/src/index.ts'],
    category: '${lib.category}',
  }`
    )
    .join(',\n')

  return `export const LIBRARIES = [
${libraryEntries}
]
`
}

describe('docs-site-library-docs', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('docs-site-library-docs')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('docs-site-library-docs')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingDocPage')
    })
  })

  describe('computeRouteSlugFromDir', () => {
    it('strips src/ prefix', () => {
      expect(computeRouteSlugFromDir('src/core')).toBe('core')
    })

    it('strips lib/ prefix after src/', () => {
      expect(computeRouteSlugFromDir('src/lib/channel')).toBe('channel')
    })

    it('handles nested paths', () => {
      expect(computeRouteSlugFromDir('src/lib/nested/deep')).toBe('nested/deep')
    })

    it('returns empty string for src alone', () => {
      expect(computeRouteSlugFromDir('src')).toBe('')
    })

    it('returns empty string for src/lib alone', () => {
      expect(computeRouteSlugFromDir('src/lib')).toBe('')
    })

    it('keeps non-src paths as lowercase', () => {
      expect(computeRouteSlugFromDir('examples')).toBe('examples')
    })

    it('converts to lowercase', () => {
      expect(computeRouteSlugFromDir('src/Core')).toBe('core')
    })

    it('returns empty string for lib alone (without src/)', () => {
      expect(computeRouteSlugFromDir('lib')).toBe('')
    })

    it('strips lib/ prefix even without src/', () => {
      expect(computeRouteSlugFromDir('lib/channel')).toBe('channel')
    })

    it('handles deeply nested lib path without src/', () => {
      expect(computeRouteSlugFromDir('lib/nested/deep/path')).toBe('nested/deep/path')
    })
  })

  describe('computeRouteSlugFromFile', () => {
    it('returns lowercase filename without extension', () => {
      expect(computeRouteSlugFromFile('ARCHITECTURE.md')).toBe('architecture')
    })

    it('handles mixed case', () => {
      expect(computeRouteSlugFromFile('DESIGN.md')).toBe('design')
    })

    it('handles already lowercase', () => {
      expect(computeRouteSlugFromFile('guide.md')).toBe('guide')
    })

    it('handles files in subdirectories (uses basename)', () => {
      expect(computeRouteSlugFromFile('src/deep/GUIDE.md')).toBe('guide')
    })

    it('handles camelCase filenames', () => {
      expect(computeRouteSlugFromFile('ApiReference.md')).toBe('apireference')
    })
  })

  describe('getExpectedPagePath', () => {
    it('returns library main page path for main README', () => {
      const mdFile = { absolutePath: '', relativePath: 'README.md', routeSlug: '', isMainPage: true }
      expect(getExpectedPagePath('nexus', 'core', mdFile)).toBe('apps/docs-site/src/app/docs/libraries/nexus/page.tsx')
    })

    it('returns architecture subpage path', () => {
      const mdFile = { absolutePath: '', relativePath: 'ARCHITECTURE.md', routeSlug: 'architecture', isMainPage: false }
      expect(getExpectedPagePath('nexus', 'core', mdFile)).toBe('apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx')
    })

    it('returns subfolder page path', () => {
      const mdFile = { absolutePath: '', relativePath: 'src/core/README.md', routeSlug: 'core', isMainPage: false }
      expect(getExpectedPagePath('project-scope', 'supporting', mdFile)).toBe(
        'apps/docs-site/src/app/docs/libraries/project-scope/core/page.tsx'
      )
    })

    it('uses plugins path for plugin category', () => {
      const mdFile = { absolutePath: '', relativePath: 'README.md', routeSlug: '', isMainPage: true }
      expect(getExpectedPagePath('features', 'plugin', mdFile)).toBe('apps/docs-site/src/app/docs/plugins/features/page.tsx')
    })

    it('handles utils with nested slug', () => {
      const mdFile = { absolutePath: '', relativePath: 'ARCHITECTURE.md', routeSlug: 'architecture', isMainPage: false }
      expect(getExpectedPagePath('utils/data', 'utils', mdFile)).toBe(
        'apps/docs-site/src/app/docs/libraries/utils/data/architecture/page.tsx'
      )
    })
  })

  describe('extractLibraryEntries', () => {
    /**
     * Creates a mock library object expression for testing.
     *
     * @param config - The library configuration containing optional fields for testing partial objects.
     * @param config.name - Display name shown in documentation.
     * @param config.slug - URL-friendly identifier for routing.
     * @param config.category - Classification (core, supporting, utils, plugin).
     * @param config.readmePath - Relative path to the README.md file.
     * @returns An ObjectExpression AST node.
     */
    function createMockLibraryObject(config: { name?: string; slug?: string; category?: string; readmePath?: string }): ObjectExpression {
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

      return {
        type: 'ObjectExpression',
        properties,
      }
    }

    it('extracts library entries from array expression', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          createMockLibraryObject({
            name: 'Nexus',
            slug: 'nexus',
            category: 'core',
            readmePath: 'libs/nexus/README.md',
          }),
          createMockLibraryObject({
            name: 'Logging',
            slug: 'logging',
            category: 'supporting',
            readmePath: 'libs/logging/README.md',
          }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toEqual([
        expect.objectContaining({ slug: 'nexus', category: 'core', name: 'Nexus', srcPath: 'libs/nexus' }),
        expect.objectContaining({ slug: 'logging', category: 'supporting', name: 'Logging', srcPath: 'libs/logging' }),
      ])
    })

    it('handles empty array', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
    })

    it('ignores entries without required fields', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          createMockLibraryObject({ name: 'Incomplete', slug: 'incomplete' }),
          createMockLibraryObject({
            name: 'Complete',
            slug: 'complete',
            category: 'core',
            readmePath: 'libs/complete/README.md',
          }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('complete')
    })

    it('handles null elements in array', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          null,
          createMockLibraryObject({
            name: 'Valid',
            slug: 'valid',
            category: 'core',
            readmePath: 'libs/valid/README.md',
          }),
          null,
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('valid')
    })

    it('handles SpreadElement in array (non-ObjectExpression)', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          { type: 'SpreadElement', argument: { type: 'Identifier', name: 'otherLibs' } as Identifier },
          createMockLibraryObject({
            name: 'Valid',
            slug: 'valid',
            category: 'core',
            readmePath: 'libs/valid/README.md',
          }),
        ],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('valid')
    })

    it('handles SpreadElement in object properties', () => {
      const objectWithSpread: ObjectExpression = {
        type: 'ObjectExpression',
        properties: [
          { type: 'SpreadElement', argument: { type: 'Identifier', name: 'baseConfig' } as Identifier },
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'name' } as Identifier,
            value: { type: 'Literal', value: 'Test' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'slug' } as Identifier,
            value: { type: 'Literal', value: 'test' } as Literal,
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
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'readmePath' } as Identifier,
            value: { type: 'Literal', value: 'libs/test/README.md' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
        ],
      }

      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [objectWithSpread],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('test')
    })

    it('handles Literal keys in object properties', () => {
      const objectWithLiteralKey: ObjectExpression = {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            key: { type: 'Literal', value: 'name' } as Literal,
            value: { type: 'Literal', value: 'Test' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
          {
            type: 'Property',
            key: { type: 'Literal', value: 'slug' } as Literal,
            value: { type: 'Literal', value: 'test' } as Literal,
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
          {
            type: 'Property',
            key: { type: 'Literal', value: 'readmePath' } as Literal,
            value: { type: 'Literal', value: 'libs/test/README.md' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
        ],
      }

      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [objectWithLiteralKey],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('test')
    })

    it('ignores properties with non-string/identifier keys', () => {
      const objectWithNumericKey: ObjectExpression = {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            key: { type: 'Literal', value: 123 } as Literal,
            value: { type: 'Literal', value: 'ignored' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'name' } as Identifier,
            value: { type: 'Literal', value: 'Test' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'slug' } as Identifier,
            value: { type: 'Literal', value: 'test' } as Literal,
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
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'readmePath' } as Identifier,
            value: { type: 'Literal', value: 'libs/test/README.md' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
        ],
      }

      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [objectWithNumericKey],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(1)
      expect(result.at(0)?.slug).toBe('test')
    })

    it('ignores entries with non-string property values', () => {
      const objectWithNonStringValue: ObjectExpression = {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'name' } as Identifier,
            value: { type: 'Identifier', name: 'someVariable' } as Identifier,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'slug' } as Identifier,
            value: { type: 'Literal', value: 'test' } as Literal,
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
          {
            type: 'Property',
            key: { type: 'Identifier', name: 'readmePath' } as Identifier,
            value: { type: 'Literal', value: 'libs/test/README.md' } as Literal,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false,
          },
        ],
      }

      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [objectWithNonStringValue],
      }

      const result = extractLibraryEntries(arrayNode)
      expect(result).toHaveLength(0)
    })
  })

  describe('getLibraryMarkdownFiles', () => {
    it('finds README.md at root as main page', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toEqual([expect.objectContaining({ relativePath: 'README.md', isMainPage: true, routeSlug: '' })])
    })

    it('finds ARCHITECTURE.md at root', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'ARCHITECTURE.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toContainEqual(expect.objectContaining({ relativePath: 'ARCHITECTURE.md', routeSlug: 'architecture' }))
    })

    it('finds markdown files in subdirectories', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'src/core/README.md', 'src/utils/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toContainEqual(expect.objectContaining({ relativePath: 'src/core/README.md', routeSlug: 'core' }))
      expect(result).toContainEqual(expect.objectContaining({ relativePath: 'src/utils/README.md', routeSlug: 'utils' }))
    })

    it('excludes CHANGELOG.md files', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'CHANGELOG.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'CHANGELOG.md' }))
    })

    it('excludes LICENSE.md files', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'LICENSE.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'LICENSE.md' }))
    })

    it('excludes CONTRIBUTING.md files', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'CONTRIBUTING.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'CONTRIBUTING.md' }))
    })

    it('excludes CODE_OF_CONDUCT.md files', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'CODE_OF_CONDUCT.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'CODE_OF_CONDUCT.md' }))
    })

    it('returns empty array for non-existent path', () => {
      const result = getLibraryMarkdownFiles('/non/existent/path/that/does/not/exist')
      expect(result).toEqual([])
    })

    it('skips node_modules directory', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'node_modules/some-package/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'node_modules/some-package/README.md' }))
    })

    it('skips dist directory', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'dist/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'dist/README.md' }))
    })

    it('skips coverage directory', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', 'coverage/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: 'coverage/README.md' }))
    })

    it('skips .nx directory', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', '.nx/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: '.nx/README.md' }))
    })

    it('skips .git directory', () => {
      const workspaceRoot = createTempWorkspace({
        libraries: [
          {
            slug: 'test-lib',
            category: 'core',
            srcPath: 'libs/test-lib',
            markdownFiles: ['README.md', '.git/README.md'],
          },
        ],
      })

      const result = getLibraryMarkdownFiles(`${workspaceRoot}/libs/test-lib`)
      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(expect.objectContaining({ relativePath: '.git/README.md' }))
    })
  })

  describe('RuleTester', () => {
    const ruleTester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    })

    ruleTester.run(RULE_NAME, rule, {
      valid: [
        {
          name: 'passes when all markdown files have corresponding pages',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'nexus',
                  category: 'core',
                  srcPath: 'libs/nexus',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
              existingPages: [
                'apps/docs-site/src/app/docs/libraries/nexus/page.tsx',
                'apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx',
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'passes when library has only main README with corresponding page',
          code: createContentTsCode([{ name: 'Simple', slug: 'simple', srcPath: 'libs/simple', category: 'supporting' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'simple',
                  category: 'supporting',
                  srcPath: 'libs/simple',
                  markdownFiles: ['README.md'],
                },
              ],
              existingPages: ['apps/docs-site/src/app/docs/libraries/simple/page.tsx'],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores non-content.ts files',
          code: createContentTsCode([{ name: 'Test', slug: 'test', srcPath: 'libs/test', category: 'core' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/other-file.ts`
          })(),
        },
        {
          name: 'ignores non-exported LIBRARIES',
          code: `const LIBRARIES = [
  {
    name: 'Test',
    packageName: '@hyperfrontend/test',
    slug: 'test',
    readmePath: 'libs/test/README.md',
    entryPoints: ['libs/test/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores let declarations of LIBRARIES',
          code: `export let LIBRARIES = [
  {
    name: 'Test',
    packageName: '@hyperfrontend/test',
    slug: 'test',
    readmePath: 'libs/test/README.md',
    entryPoints: ['libs/test/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores var declarations of LIBRARIES',
          code: `export var LIBRARIES = [
  {
    name: 'Test',
    packageName: '@hyperfrontend/test',
    slug: 'test',
    readmePath: 'libs/test/README.md',
    entryPoints: ['libs/test/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores LIBRARIES initialized to non-array',
          code: `export const LIBRARIES = createLibraries()`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores exported const with different name',
          code: `export const OTHER_CONST = [
  {
    name: 'Test',
    packageName: '@hyperfrontend/test',
    slug: 'test',
    readmePath: 'libs/test/README.md',
    entryPoints: ['libs/test/src/index.ts'],
    category: 'core',
  }
]`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores destructuring declarations',
          code: `export const { LIBRARIES } = config`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
        {
          name: 'ignores LIBRARIES with undefined initializer',
          code: `export const LIBRARIES = undefined`,
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
        },
      ],
      invalid: [
        {
          name: 'reports missing architecture page',
          code: createContentTsCode([{ name: 'Nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'nexus',
                  category: 'core',
                  srcPath: 'libs/nexus',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md'],
                },
              ],
              existingPages: ['apps/docs-site/src/app/docs/libraries/nexus/page.tsx'],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingDocPage',
              data: {
                name: 'Nexus',
                markdownPath: 'ARCHITECTURE.md',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports missing subdirectory page',
          code: createContentTsCode([
            { name: 'Project Scope', slug: 'project-scope', srcPath: 'libs/project-scope', category: 'supporting' },
          ]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'project-scope',
                  category: 'supporting',
                  srcPath: 'libs/project-scope',
                  markdownFiles: ['README.md', 'src/core/README.md'],
                },
              ],
              existingPages: ['apps/docs-site/src/app/docs/libraries/project-scope/page.tsx'],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingDocPage',
              data: {
                name: 'Project Scope',
                markdownPath: 'src/core/README.md',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/project-scope/core/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports missing main page',
          code: createContentTsCode([{ name: 'Test', slug: 'test', srcPath: 'libs/test', category: 'core' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'test',
                  category: 'core',
                  srcPath: 'libs/test',
                  markdownFiles: ['README.md'],
                },
              ],
              existingPages: [],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingDocPage',
              data: {
                name: 'Test',
                markdownPath: 'README.md',
                expectedPath: 'apps/docs-site/src/app/docs/libraries/test/page.tsx',
              },
            },
          ],
        },
        {
          name: 'reports multiple missing pages',
          code: createContentTsCode([{ name: 'Multi', slug: 'multi', srcPath: 'libs/multi', category: 'core' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'multi',
                  category: 'core',
                  srcPath: 'libs/multi',
                  markdownFiles: ['README.md', 'ARCHITECTURE.md', 'DESIGN.md'],
                },
              ],
              existingPages: [],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [{ messageId: 'missingDocPage' }, { messageId: 'missingDocPage' }, { messageId: 'missingDocPage' }],
        },
        {
          name: 'reports missing plugin page in correct path',
          code: createContentTsCode([{ name: 'Features', slug: 'features', srcPath: 'plugins/features', category: 'plugin' }]),
          filename: (() => {
            const workspaceRoot = createTempWorkspace({
              libraries: [
                {
                  slug: 'features',
                  category: 'plugin',
                  srcPath: 'plugins/features',
                  markdownFiles: ['README.md'],
                },
              ],
              existingPages: [],
            })
            return `${workspaceRoot}/apps/docs-site/src/lib/content.ts`
          })(),
          errors: [
            {
              messageId: 'missingDocPage',
              data: {
                name: 'Features',
                markdownPath: 'README.md',
                expectedPath: 'apps/docs-site/src/app/docs/plugins/features/page.tsx',
              },
            },
          ],
        },
      ],
    })
  })
})
