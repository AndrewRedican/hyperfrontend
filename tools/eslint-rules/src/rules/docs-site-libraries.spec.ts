import type { ArrayExpression, Literal, ObjectExpression, Property, SpreadElement } from 'estree'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { RuleTester } from 'eslint'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, { RULE_NAME, extractPackageNamesFromArray, getAllPublishableLibraries } from './docs-site-libraries'

const manager = createTempWorkspaceManager()

/**
 * Valid publishable library project.json for testing.
 */
const PUBLISHABLE_PROJECT_JSON = {
  name: 'lib-test-library',
  description: 'A test library',
  projectType: 'library',
  targets: { build: {}, publish: {} },
}

/**
 * Non-publishable library project.json (no publish target).
 */
const NON_PUBLISHABLE_PROJECT_JSON = {
  name: 'lib-internal',
  description: 'An internal library',
  projectType: 'library',
  targets: { build: {} },
}

/**
 * One project inside a temporary workspace.
 */
interface TempProject {
  /** Directory name under libs/ or plugins/ */
  name: string
  /** project.json contents */
  projectJson: object
  /** package.json contents, omitted to simulate a project without one */
  packageJson?: object
}

/**
 * Configuration for a temporary workspace.
 */
interface TempWorkspaceConfig {
  /** Projects created under libs/ */
  libs?: TempProject[]
  /** Projects created under plugins/ */
  plugins?: TempProject[]
  /** Package names the ecosystem hierarchy places, omitted to leave ecosystem.ts absent */
  ecosystem?: string[]
}

/**
 * Creates a temporary workspace structure for testing.
 *
 * @param config - Configuration for the workspace.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: TempWorkspaceConfig): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  if (config.ecosystem) {
    const placed = config.ecosystem.map((name) => `'${name}'`).join(', ')
    files['apps/docs-site/src/lib/ecosystem.ts'] = `export const ECOSYSTEM_TIERS = [{ id: 'sdk', packages: [${placed}] }]\n`
  }

  if (config.libs && config.libs.length > 0) {
    for (const lib of config.libs) {
      files[`libs/${lib.name}/project.json`] = JSON.stringify(lib.projectJson, null, 2)
      if (lib.packageJson) {
        files[`libs/${lib.name}/package.json`] = JSON.stringify(lib.packageJson, null, 2)
      }
    }
  }

  if (config.plugins && config.plugins.length > 0) {
    for (const plugin of config.plugins) {
      files[`plugins/${plugin.name}/project.json`] = JSON.stringify(plugin.projectJson, null, 2)
      if (plugin.packageJson) {
        files[`plugins/${plugin.name}/package.json`] = JSON.stringify(plugin.packageJson, null, 2)
      }
    }
  }

  const workspace = manager.create({
    files,
    directories: ['apps/docs-site/src/lib'],
  })
  return workspace.root
}

/**
 * Creates content.ts code that lists the given package names.
 * Uses plain JavaScript syntax (no TypeScript types) for parser compatibility.
 *
 * @param packageNames - Array of package names to include.
 * @returns JavaScript code for content.ts.
 */
function createContentTsCode(packageNames: string[]): string {
  const libraryEntries = packageNames
    .map(
      (name, index) => `  {
    name: 'Library ${index + 1}',
    packageName: '${name}',
    slug: 'lib-${index + 1}',
    readmePath: 'libs/lib-${index + 1}/README.md',
    entryPoints: ['libs/lib-${index + 1}/src/index.ts'],
    category: 'core',
  }`
    )
    .join(',\n')

  return `export const LIBRARIES = [
${libraryEntries}
]
`
}

describe('docs-site-libraries', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('docs-site-libraries')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('docs-site-libraries')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingLibrary')
      expect(messageIds).toContain('missingFromEcosystem')
    })
  })

  describe('getAllPublishableLibraries', () => {
    it('finds publishable libraries in libs folder', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/logging' },
          },
        ],
      })

      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toEqual([expect.objectContaining({ packageName: '@hyperfrontend/logging', relativePath: 'libs/logging' })])
    })

    it('finds publishable libraries in plugins folder', () => {
      const workspaceDir = createTempWorkspace({
        plugins: [
          {
            name: 'features',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/features' },
          },
        ],
      })

      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toEqual([expect.objectContaining({ packageName: '@hyperfrontend/features', relativePath: 'plugins/features' })])
    })

    it('ignores non-publishable libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'internal',
            projectJson: NON_PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/internal' },
          },
        ],
      })

      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toHaveLength(0)
    })

    it('ignores libraries without package.json', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'no-package',
            projectJson: PUBLISHABLE_PROJECT_JSON,
          },
        ],
      })

      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toHaveLength(0)
    })

    it('handles nested library structures', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/utils/json/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON, null, 2),
          'libs/utils/json/package.json': JSON.stringify({ name: '@hyperfrontend/json-utils' }, null, 2),
        },
        directories: ['apps/docs-site/src/lib'],
      })

      const result = getAllPublishableLibraries(workspace.root)
      expect(result).toEqual([expect.objectContaining({ packageName: '@hyperfrontend/json-utils', relativePath: 'libs/utils/json' })])
    })

    it('handles empty workspace', () => {
      const workspaceDir = createTempWorkspace({})
      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toHaveLength(0)
    })

    it('handles multiple publishable libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/logging' },
          },
          {
            name: 'nexus',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/nexus' },
          },
        ],
        plugins: [
          {
            name: 'features',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/features' },
          },
        ],
      })

      const result = getAllPublishableLibraries(workspaceDir)
      expect(result).toHaveLength(3)

      const packageNames = result.map((lib) => lib.packageName)
      expect(packageNames).toContain('@hyperfrontend/logging')
      expect(packageNames).toContain('@hyperfrontend/nexus')
      expect(packageNames).toContain('@hyperfrontend/features')
    })
  })

  describe('extractPackageNamesFromArray', () => {
    /**
     * Creates a mock array expression node for testing.
     *
     * @param entries - Array of packageName values.
     * @returns A partial ArrayExpression node.
     */
    function createMockArrayExpression(entries: (string | null)[]): ArrayExpression {
      const elements = entries.map((packageName) => {
        if (packageName === null) {
          return { type: 'Literal', value: 'not-an-object' } as Literal
        }

        return {
          type: 'ObjectExpression',
          properties: [
            {
              type: 'Property',
              key: { type: 'Identifier', name: 'name' },
              value: { type: 'Literal', value: 'Library' },
            },
            {
              type: 'Property',
              key: { type: 'Identifier', name: 'packageName' },
              value: { type: 'Literal', value: packageName },
            },
          ],
        } as ObjectExpression
      })

      return {
        type: 'ArrayExpression',
        elements,
      } as ArrayExpression
    }

    it('extracts package names from array expression', () => {
      const arrayNode = createMockArrayExpression(['@hyperfrontend/nexus', '@hyperfrontend/logging'])

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(2)
      expect(result.has('@hyperfrontend/nexus')).toBe(true)
      expect(result.has('@hyperfrontend/logging')).toBe(true)
    })

    it('handles empty array', () => {
      const arrayNode = createMockArrayExpression([])

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(0)
    })

    it('ignores non-object elements', () => {
      const arrayNode = createMockArrayExpression(['@hyperfrontend/nexus', null, '@hyperfrontend/logging'])

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(2)
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
                key: { type: 'Literal', value: 'packageName' } as Literal,
                value: { type: 'Literal', value: '@hyperfrontend/nexus' } as Literal,
              } as Property,
            ],
          } as ObjectExpression,
        ],
      } as ArrayExpression

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(1)
      expect(result.has('@hyperfrontend/nexus')).toBe(true)
    })

    it('ignores properties that are not packageName', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'name' },
                value: { type: 'Literal', value: 'Nexus' },
              } as Property,
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'slug' },
                value: { type: 'Literal', value: 'nexus' },
              } as Property,
            ],
          } as ObjectExpression,
        ],
      } as ArrayExpression

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(0)
    })

    it('ignores non-string packageName values', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'packageName' },
                value: { type: 'Literal', value: 42 } as Literal,
              } as Property,
            ],
          } as ObjectExpression,
        ],
      } as ArrayExpression

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(0)
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
                key: { type: 'Identifier', name: 'packageName' },
                value: { type: 'Literal', value: '@hyperfrontend/nexus' },
              } as Property,
            ],
          } as ObjectExpression,
        ],
      } as ArrayExpression

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(1)
      expect(result.has('@hyperfrontend/nexus')).toBe(true)
    })

    it('handles null elements in array', () => {
      const arrayNode: ArrayExpression = {
        type: 'ArrayExpression',
        elements: [
          null,
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: { type: 'Identifier', name: 'packageName' },
                value: { type: 'Literal', value: '@hyperfrontend/nexus' },
              } as Property,
            ],
          } as ObjectExpression,
        ],
      } as ArrayExpression

      const result = extractPackageNamesFromArray(arrayNode)
      expect(result.size).toBe(1)
    })
  })

  describe('rule behavior', () => {
    it('ignores non-content.ts files', () => {
      const handler = rule.create({
        filename: '/some/path/index.ts',
        sourceCode: { getText: () => '' },
        options: [],
        parserServices: undefined,
        settings: {},
        parserPath: '',
        languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
      } as never)

      expect(Object.keys(handler)).toEqual([])
    })

    it('ignores content.ts files not in docs-site/src/lib/', () => {
      const handler = rule.create({
        filename: '/some/other/path/content.ts',
        sourceCode: { getText: () => '' },
        options: [],
        parserServices: undefined,
        settings: {},
        parserPath: '',
        languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
      } as never)

      expect(Object.keys(handler)).toEqual([])
    })
  })

  describe('RuleTester', () => {
    const ruleTester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    })

    ruleTester.run('docs-site-libraries', rule, {
      valid: [
        {
          name: 'passes when LIBRARIES array is not exported',
          code: `const LIBRARIES = []`,
          filename: (() => {
            const dir = createTempWorkspace({ libs: [] })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'passes when all libraries are listed',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'passes with no publishable libraries in workspace',
          code: createContentTsCode([]),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'internal', projectJson: NON_PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/internal' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'handles plugins',
          code: createContentTsCode(['@hyperfrontend/features']),
          filename: (() => {
            const dir = createTempWorkspace({
              plugins: [{ name: 'features', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/features' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'ignores let declarations',
          code: `export let LIBRARIES = []`,
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'ignores non-array initializers',
          code: `export const LIBRARIES = {}`,
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'ignores non-exported LIBRARIES',
          code: `const LIBRARIES = []`,
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'ignores different variable names',
          code: `export const OTHER_ARRAY = []`,
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'passes when a listed library is also placed in the ecosystem hierarchy',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
              ecosystem: ['@hyperfrontend/logging'],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
        },
        {
          name: 'leaves the ecosystem hierarchy unchecked from generate-docs.ts',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
              ecosystem: [],
            })
            return join(dir, 'apps', 'docs-site', 'scripts', 'generate-docs.ts')
          })(),
        },
      ],
      invalid: [
        {
          name: 'reports a library the ecosystem hierarchy does not place',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
              ecosystem: ['@hyperfrontend/nexus'],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [{ messageId: 'missingFromEcosystem' }],
        },
        {
          name: 'reports both the missing listing and the missing placement',
          code: createContentTsCode([]),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
              ecosystem: [],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [{ messageId: 'missingLibrary' }, { messageId: 'missingFromEcosystem' }],
        },
        {
          name: 'reports missing library',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [
                { name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } },
                { name: 'nexus', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/nexus' } },
              ],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [
            {
              messageId: 'missingLibrary',
              data: {
                packageName: '@hyperfrontend/nexus',
                path: 'libs/nexus',
              },
            },
          ],
        },
        {
          name: 'reports multiple missing libraries',
          code: createContentTsCode(['@hyperfrontend/logging']),
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [
                { name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } },
                { name: 'nexus', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/nexus' } },
                { name: 'cryptography', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/cryptography' } },
              ],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [
            {
              messageId: 'missingLibrary',
              data: {
                packageName: '@hyperfrontend/cryptography',
                path: 'libs/cryptography',
              },
            },
            {
              messageId: 'missingLibrary',
              data: {
                packageName: '@hyperfrontend/nexus',
                path: 'libs/nexus',
              },
            },
          ],
        },
        {
          name: 'handles empty LIBRARIES array',
          code: `export const LIBRARIES = []
`,
          filename: (() => {
            const dir = createTempWorkspace({
              libs: [{ name: 'logging', projectJson: PUBLISHABLE_PROJECT_JSON, packageJson: { name: '@hyperfrontend/logging' } }],
            })
            return join(dir, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [
            {
              messageId: 'missingLibrary',
              data: {
                packageName: '@hyperfrontend/logging',
                path: 'libs/logging',
              },
            },
          ],
        },
        {
          name: 'handles nested library paths',
          code: createContentTsCode([]),
          filename: (() => {
            const workspace = manager.create({
              files: {
                'nx.json': JSON.stringify({ version: 2 }, null, 2),
                'libs/utils/json/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON, null, 2),
                'libs/utils/json/package.json': JSON.stringify({ name: '@hyperfrontend/json-utils' }, null, 2),
              },
              directories: ['apps/docs-site/src/lib'],
            })
            return join(workspace.root, 'apps', 'docs-site', 'src', 'lib', 'content.ts')
          })(),
          errors: [
            {
              messageId: 'missingLibrary',
              data: {
                packageName: '@hyperfrontend/json-utils',
                path: 'libs/utils/json',
              },
            },
          ],
        },
      ],
    })
  })
})
