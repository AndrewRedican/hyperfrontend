import { join } from 'node:path'
import { createTempWorkspaceManager } from '../testing'
import rule, { extractMentionedPaths, parseReadmeSections, RULE_NAME } from './root-readme-packages'

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
 * Creates a valid root README.md content that lists all packages.
 *
 * @param mainPackages - Array of main package paths.
 * @param internalPackages - Array of internal package paths.
 * @returns A string containing the README content.
 */
function createValidReadme(mainPackages: string[], internalPackages: string[]): string {
  const mainRows = mainPackages
    .map((path) => `| [pkg](https://github.com/AndrewRedican/hyperfrontend/blob/main/${path}) | A library package |`)
    .join('\n')
  const internalRows = internalPackages
    .map((path) => `| [pkg](https://github.com/AndrewRedican/hyperfrontend/blob/main/${path}) | An internal package |`)
    .join('\n')

  return `# hyperfrontend

Description of the project.

## Main Packages

| Package | Description |
| ------- | ----------- |
${mainRows}

## Internal Packages

| Package | Description |
| ------- | ----------- |
${internalRows}
`
}

describe('root-readme-packages', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('root-readme-packages')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('root-readme-packages')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingPackage')
      expect(messageIds).toContain('missingMainPackagesSection')
      expect(messageIds).toContain('missingInternalPackagesSection')
    })
  })

  describe('extractMentionedPaths', () => {
    it('extracts paths from table rows with GitHub links', () => {
      const content = `| Package | Description |
| ------- | ----------- |
| [logging](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/logging) | A logging library |
| [nexus](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus) | Core nexus library |`

      const paths = extractMentionedPaths(content)
      expect(paths).toContain('libs/logging')
      expect(paths).toContain('libs/nexus')
      expect(paths).toHaveLength(2)
    })

    it('extracts paths from plugins folder', () => {
      const content = `| Package | Description |
| ------- | ----------- |
| [@hyperfrontend/features](https://github.com/AndrewRedican/hyperfrontend/blob/main/plugins/features) | Nx plugin |`

      const paths = extractMentionedPaths(content)
      expect(paths).toContain('plugins/features')
      expect(paths).toHaveLength(1)
    })

    it('ignores table header and separator rows', () => {
      const content = `| Package | Description |
|---------|-------------|
| [lib](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/test) | Test |`

      const paths = extractMentionedPaths(content)
      expect(paths).toContain('libs/test')
      expect(paths).toHaveLength(1)
    })

    it('ignores paths not in libs/ or plugins/', () => {
      const content = `| [app](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demo) | App |`

      const paths = extractMentionedPaths(content)
      expect(paths).toHaveLength(0)
    })

    it('handles nested library paths', () => {
      const content = `| [json-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/json) | JSON utils |`

      const paths = extractMentionedPaths(content)
      expect(paths).toContain('libs/utils/json')
    })

    it('returns empty array for empty content', () => {
      const paths = extractMentionedPaths('')
      expect(paths).toHaveLength(0)
    })

    it('returns empty array for content without GitHub links', () => {
      const content = 'Just some text without any links'
      const paths = extractMentionedPaths(content)
      expect(paths).toHaveLength(0)
    })

    it('handles malformed links without closing parenthesis', () => {
      const content = `| [lib](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/test | Broken |`
      const paths = extractMentionedPaths(content)
      expect(paths).toHaveLength(0)
    })
  })

  describe('parseReadmeSections', () => {
    it('parses level 2 sections correctly', () => {
      const content = `# Title

## Section One

Content for section one.

## Section Two

Content for section two.
`
      const sections = parseReadmeSections(content)

      expect(sections.has('Section One')).toBe(true)
      expect(sections.has('Section Two')).toBe(true)
      expect(sections.get('Section One')?.content).toContain('Content for section one')
    })

    it('ignores level 3 headings as section starts', () => {
      const content = `## Main Section

### Subsection

Content here.

## Another Section

More content.
`
      const sections = parseReadmeSections(content)

      expect(sections.has('Main Section')).toBe(true)
      expect(sections.has('Another Section')).toBe(true)
      expect(sections.has('Subsection')).toBe(false)
    })

    it('handles content before any section', () => {
      const content = `Some intro text.

## First Section

Content.
`
      const sections = parseReadmeSections(content)
      expect(sections.has('First Section')).toBe(true)
    })

    it('handles empty content', () => {
      const sections = parseReadmeSections('')
      expect(sections.size).toBe(0)
    })

    it('handles content with no sections', () => {
      const content = 'Just some text without any sections'
      const sections = parseReadmeSections(content)
      expect(sections.size).toBe(0)
    })
  })

  describe('rule behavior', () => {
    it('ignores non-README.md files', () => {
      const handler = rule.create({
        filename: '/some/path/index.ts',
        sourceCode: { getText: () => '' },
      } as never)

      expect(handler).toEqual({})
    })

    it('ignores README.md not at workspace root', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
        },
        directories: ['libs/some-lib'],
      })

      const handler = rule.create({
        filename: join(workspace.root, 'libs', 'some-lib', 'README.md'),
        sourceCode: { getText: () => '# Some content' },
      } as never)

      expect(handler).toEqual({})
    })

    it('reports missing Main Packages section', () => {
      const workspaceDir = createTempWorkspace({ libs: [] })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => `# README

## Internal Packages

| Package | Description |
| ------- | ----------- |
`,
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingMainPackagesSection' }))
    })

    it('reports missing Internal Packages section', () => {
      const workspaceDir = createTempWorkspace({ libs: [] })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => `# README

## Main Packages

| Package | Description |
| ------- | ----------- |
`,
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingInternalPackagesSection' }))
    })

    it('reports missing publishable library', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/logging' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          // README does not list libs/logging
          getText: () => createValidReadme([], []),
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
          messageId: 'missingPackage',
          data: expect.objectContaining({ path: 'libs/logging' }),
        })
      )
    })

    it('passes when all publishable libraries are listed', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'logging',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/logging' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], ['libs/logging']),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingPackage' }))
    })

    it('ignores non-publishable libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'internal',
            projectJson: NON_PUBLISHABLE_PROJECT_JSON,
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], []),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      expect(reportMock).not.toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingPackage' }))
    })

    it('handles nested publishable libraries', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/utils/json/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON, null, 2),
          'libs/utils/json/package.json': JSON.stringify({ name: '@hyperfrontend/json-utils' }, null, 2),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: join(workspace.root, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], []),
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
          messageId: 'missingPackage',
          data: expect.objectContaining({ path: 'libs/utils/json' }),
        })
      )
    })

    it('handles publishable plugins', () => {
      const workspaceDir = createTempWorkspace({
        plugins: [
          {
            name: 'features',
            projectJson: PUBLISHABLE_PROJECT_JSON,
            packageJson: { name: '@hyperfrontend/features' },
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], []),
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
          messageId: 'missingPackage',
          data: expect.objectContaining({ path: 'plugins/features' }),
        })
      )
    })

    it('uses project name when package.json is missing', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'no-package-json',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-no-package-json' },
            // no packageJson
          },
        ],
      })
      const reportMock = jest.fn()
      const context = {
        filename: join(workspaceDir, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], []),
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
          messageId: 'missingPackage',
          data: expect.objectContaining({ name: 'lib-no-package-json' }),
        })
      )
    })

    it('skips hidden directories and node_modules', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/.hidden/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON, null, 2),
          'libs/node_modules/some-pkg/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON, null, 2),
        },
      })

      const reportMock = jest.fn()
      const context = {
        filename: join(workspace.root, 'README.md'),
        sourceCode: {
          getText: () => createValidReadme([], []),
        },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const handler = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      handler['root']?.(mockNode)

      // Should not report either hidden or node_modules projects
      expect(reportMock).not.toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingPackage' }))
    })
  })
})
