import { join } from 'node:path'
import { createTempWorkspaceManager } from '../testing'
import rule, { extractMentionedPackages, RULE_NAME } from './lib-compatibility-docs'

const manager = createTempWorkspaceManager()

/**
 * Valid publishable library project.json with browser bundles for testing.
 */
const PUBLISHABLE_WITH_BROWSER_BUNDLES = {
  name: 'lib-test-library',
  description: 'A test library',
  projectType: 'library',
  targets: {
    build: {
      options: {
        iife: { entry: '.', globalName: 'TestLibrary' },
        umd: { entry: '.', globalName: 'TestLibrary' },
      },
    },
    publish: {},
  },
}

/**
 * Valid publishable library project.json without browser bundles (Node.js only).
 */
const PUBLISHABLE_WITHOUT_BROWSER_BUNDLES = {
  name: 'lib-tooling',
  description: 'A Node.js tooling library',
  projectType: 'library',
  targets: {
    build: {
      options: {
        esm: { bundleWorkspaceDeps: true },
        cjs: { bundleWorkspaceDeps: true },
      },
    },
    publish: {},
  },
}

/**
 * Non-publishable library project.json (no publish target).
 */
const NON_PUBLISHABLE_WITH_BROWSER_BUNDLES = {
  name: 'lib-internal',
  description: 'An internal library',
  projectType: 'library',
  targets: { build: {} },
}

/**
 * Creates a temporary workspace structure for testing.
 *
 * @param config - Configuration for the workspace.
 * @param config.libs - Array of library configurations.
 * @param config.plugins - Array of plugin configurations.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: {
  libs?: Array<{ name: string; projectJson: object; packageJson?: object }>
  plugins?: Array<{ name: string; projectJson: object; packageJson?: object }>
}): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  // Create libraries
  if (config.libs && config.libs.length > 0) {
    for (const lib of config.libs) {
      files[`libs/${lib.name}/project.json`] = JSON.stringify(lib.projectJson, null, 2)
      if (lib.packageJson) {
        files[`libs/${lib.name}/package.json`] = JSON.stringify(lib.packageJson, null, 2)
      }
    }
  }

  // Create plugins
  if (config.plugins && config.plugins.length > 0) {
    for (const plugin of config.plugins) {
      files[`plugins/${plugin.name}/project.json`] = JSON.stringify(plugin.projectJson, null, 2)
      if (plugin.packageJson) {
        files[`plugins/${plugin.name}/package.json`] = JSON.stringify(plugin.packageJson, null, 2)
      }
    }
  }

  const workspace = manager.create({ files })
  return workspace.root
}

/**
 * Creates a valid LIBRARY_COMPATIBILITY.md content that lists all packages.
 *
 * @param packages - Array of package names to include.
 * @returns A string containing the document content.
 */
function createValidCompatibilityDoc(packages: string[]): string {
  const packageRows = packages.map((pkg) => `| \`${pkg}\` |   ✅    |   ✅    |     ✅     |     ✅     |`).join('\n')

  return `# Library Compatibility Matrix

> **Can I Use** style reference for @hyperfrontend libraries

---

## Platform Support Overview

| Library                                 | Browser | Node.js | Web Worker | CDN Bundle |
| --------------------------------------- | :-----: | :-----: | :--------: | :--------: |
${packageRows}
`
}

describe('lib-compatibility-docs', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-compatibility-docs')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('lib-compatibility-docs')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingLibrary')
    })
  })

  describe('extractMentionedPackages', () => {
    it('extracts package names from backticks', () => {
      const content = `| \`@hyperfrontend/data-utils\` | ✅ |
| \`@hyperfrontend/logging\` | ✅ |`

      const packages = extractMentionedPackages(content)
      expect(packages.has('@hyperfrontend/data-utils')).toBe(true)
      expect(packages.has('@hyperfrontend/logging')).toBe(true)
      expect(packages.size).toBe(2)
    })

    it('extracts package names from multiple sections', () => {
      const content = `## Section One
| \`@hyperfrontend/data-utils\` | ✅ |

## Section Two
| \`@hyperfrontend/logging\` | ✅ |
| \`@hyperfrontend/cryptography\` | ✅ |`

      const packages = extractMentionedPackages(content)
      expect(packages.has('@hyperfrontend/data-utils')).toBe(true)
      expect(packages.has('@hyperfrontend/logging')).toBe(true)
      expect(packages.has('@hyperfrontend/cryptography')).toBe(true)
      expect(packages.size).toBe(3)
    })

    it('handles packages with hyphens', () => {
      const content = `| \`@hyperfrontend/random-generator-utils\` | ✅ |`

      const packages = extractMentionedPackages(content)
      expect(packages.has('@hyperfrontend/random-generator-utils')).toBe(true)
    })

    it('deduplicates repeated mentions', () => {
      const content = `| \`@hyperfrontend/data-utils\` | Browser |
| \`@hyperfrontend/data-utils\` | Node.js |`

      const packages = extractMentionedPackages(content)
      expect(packages.size).toBe(1)
      expect(packages.has('@hyperfrontend/data-utils')).toBe(true)
    })

    it('returns empty set for empty content', () => {
      const packages = extractMentionedPackages('')
      expect(packages.size).toBe(0)
    })

    it('returns empty set for content without packages', () => {
      const content = 'Just some text without any package mentions'
      const packages = extractMentionedPackages(content)
      expect(packages.size).toBe(0)
    })

    it('ignores packages without backticks', () => {
      const content = '@hyperfrontend/data-utils without backticks'
      const packages = extractMentionedPackages(content)
      expect(packages.size).toBe(0)
    })

    it('ignores non-hyperfrontend packages', () => {
      const content = '`@other/package`'
      const packages = extractMentionedPackages(content)
      expect(packages.size).toBe(0)
    })
  })

  describe('rule behavior', () => {
    it('ignores non-LIBRARY_COMPATIBILITY.md files', () => {
      const handler = rule.create({
        filename: '/some/path/README.md',
        sourceCode: { getText: () => '' },
      } as never)

      expect(handler).toEqual({})
    })

    it('ignores LIBRARY_COMPATIBILITY.md not at workspace root', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
        },
        directories: ['libs/some-lib'],
      })

      const handler = rule.create({
        filename: join(workspace.root, 'libs', 'some-lib', 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: { getText: () => '# Some content' },
      } as never)

      expect(handler).toEqual({})
    })

    it('reports missing publishable library', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/logging' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          // Document does not list @hyperfrontend/logging
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingLibrary',
          data: expect.objectContaining({
            packageName: '@hyperfrontend/logging',
            path: 'libs/logging',
          }),
        })
      )
    })

    it('passes when all publishable libraries are listed', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/logging' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc(['@hyperfrontend/logging']),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('ignores non-publishable libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'internal',
            projectJson: NON_PUBLISHABLE_WITH_BROWSER_BUNDLES,
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('ignores publishable libraries without browser bundles (Node.js tooling)', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'tooling',
            projectJson: PUBLISHABLE_WITHOUT_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/tooling' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('ignores libraries without package.json', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'no-pkg',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            // No packageJson
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('handles nested publishable libraries', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/utils/json/project.json': JSON.stringify(PUBLISHABLE_WITH_BROWSER_BUNDLES, null, 2),
          'libs/utils/json/package.json': JSON.stringify({ name: '@hyperfrontend/json-utils' }, null, 2),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: join(workspace.root, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingLibrary',
          data: expect.objectContaining({
            packageName: '@hyperfrontend/json-utils',
            path: 'libs/utils/json',
          }),
        })
      )
    })

    it('handles publishable plugins', () => {
      const workspaceDir = createTempWorkspace({
        plugins: [
          {
            name: 'features',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/features' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingLibrary',
          data: expect.objectContaining({
            packageName: '@hyperfrontend/features',
            path: 'plugins/features',
          }),
        })
      )
    })

    it('handles multiple missing libraries in deterministic order', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/logging' },
          },
          {
            name: 'data-utils',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/data-utils' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledTimes(2)
      // Should be sorted alphabetically by packageName
      expect(reportMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({ packageName: '@hyperfrontend/data-utils' }),
        })
      )
      expect(reportMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ packageName: '@hyperfrontend/logging' }),
        })
      )
    })

    it('handles mixture of listed and missing libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/logging' },
          },
          {
            name: 'data-utils',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/data-utils' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          // Only data-utils is listed
          getText: () => createValidCompatibilityDoc(['@hyperfrontend/data-utils']),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      // Only logging should be reported
      expect(reportMock).toHaveBeenCalledTimes(1)
      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ packageName: '@hyperfrontend/logging' }),
        })
      )
    })

    it('only reports browser-bundled libraries when mixed with Node.js tooling', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'browser-lib',
            projectJson: PUBLISHABLE_WITH_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/browser-lib' },
          },
          {
            name: 'node-tooling',
            projectJson: PUBLISHABLE_WITHOUT_BROWSER_BUNDLES,
            packageJson: { name: '@hyperfrontend/node-tooling' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: {
          getText: () => createValidCompatibilityDoc([]),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      // Only browser-lib should be reported, not node-tooling
      expect(reportMock).toHaveBeenCalledTimes(1)
      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ packageName: '@hyperfrontend/browser-lib' }),
        })
      )
    })
  })
})
