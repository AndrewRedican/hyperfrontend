import {
  APPLICATION_PROJECT_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
  createJsonRuleTester,
  createTempWorkspaceManager,
} from '../testing'
import rule, { RULE_NAME, getExpectedReadmePath, inspectReadmeContent } from './lib-pkg-secondary-entry-readme'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Configuration for seeding a publishable-library temp workspace.
 */
interface LibraryWorkspaceConfig {
  /** Override the package.json `exports` map. When omitted, `subpaths` is used. */
  rawExports?: unknown
  /** Subpath keys to include in package.json `exports` (auto-paired with `./src/<sub>/index.js`). */
  subpaths?: string[]
  /** Project.json fixture (defaults to publishable). */
  projectJson?: object
  /** README files to seed, keyed by path relative to library root. */
  readmes?: Record<string, string>
}

/**
 * Builds a temporary publishable library with a package.json + project.json,
 * plus any README files needed by a test case.
 *
 * @param config - Library configuration.
 * @returns Absolute path to the seeded `package.json`.
 */
function createLibraryWorkspace(config: LibraryWorkspaceConfig = {}): string {
  let exportsValue: unknown
  if (config.rawExports !== undefined) {
    exportsValue = config.rawExports
  } else {
    const exportsMap: Record<string, string> = { '.': './src/index.js' }
    for (const subpath of config.subpaths ?? []) {
      exportsMap[`./${subpath}`] = `./src/${subpath}/index.js`
    }
    exportsValue = exportsMap
  }

  const packageJson: Record<string, unknown> = { name: '@hyperfrontend/test' }
  if (exportsValue !== null) {
    packageJson['exports'] = exportsValue
  }

  const workspace = manager.create({
    projectJson: config.projectJson ?? PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson,
    files: config.readmes,
  })

  return workspace.getPath('package.json')
}

/**
 * Serializes the package.json `exports` shape into the JSON code passed to RuleTester.
 *
 * @param exports - The exports map.
 * @returns JSON string with `exports` field.
 */
function jsonWithExports(exports: unknown): string {
  return JSON.stringify({ name: '@hyperfrontend/test', exports }, null, 2)
}

describe('lib-pkg-secondary-entry-readme', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-pkg-secondary-entry-readme')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url pointing at the rule slug', () => {
      expect(rule.meta?.docs?.url).toContain('lib-pkg-secondary-entry-readme')
    })

    it('declares the three required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingSecondaryReadme')
      expect(messageIds).toContain('missingReadmeHeading')
      expect(messageIds).toContain('missingReadmeDescription')
    })
  })

  describe('getExpectedReadmePath', () => {
    it('joins root, src, subpath, and README.md', () => {
      expect(getExpectedReadmePath('libs/versioning', 'commits/parse')).toBe('libs/versioning/src/commits/parse/README.md')
    })

    it('handles single-segment subpaths', () => {
      expect(getExpectedReadmePath('libs/nexus', 'core')).toBe('libs/nexus/src/core/README.md')
    })

    it('returns library-relative path when given "."', () => {
      expect(getExpectedReadmePath('.', 'semver')).toBe('src/semver/README.md')
    })
  })

  describe('inspectReadmeContent', () => {
    it('flags both heading and description missing when no H1 is present', () => {
      expect(inspectReadmeContent('Just some text\n', 'parse')).toEqual({
        hasMatchingHeading: false,
        hasDescription: false,
      })
    })

    it('flags both heading and description missing when content is empty', () => {
      expect(inspectReadmeContent('', 'parse')).toEqual({
        hasMatchingHeading: false,
        hasDescription: false,
      })
    })

    it('passes when H1 matches expected name', () => {
      expect(inspectReadmeContent('# parse\n\nDoes a thing.\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })

    it('matches H1 case-insensitively', () => {
      expect(inspectReadmeContent('# Parse\n\nDoes a thing.\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })

    it('matches H1 with trailing slash', () => {
      expect(inspectReadmeContent('# semver/\n\nDoes a thing.\n', 'semver')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })

    it('matches H1 with trailing " Module" suffix', () => {
      expect(inspectReadmeContent('# Heuristics Module\n\nDoes a thing.\n', 'heuristics')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })

    it('flags heading mismatch when H1 differs from expected', () => {
      expect(inspectReadmeContent('# unrelated\n\nDoes a thing.\n', 'parse')).toEqual({
        hasMatchingHeading: false,
        hasDescription: true,
      })
    })

    it('flags missing description when only H1 exists', () => {
      expect(inspectReadmeContent('# parse\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: false,
      })
    })

    it('flags missing description when content beneath H1 is only blank lines', () => {
      expect(inspectReadmeContent('# parse\n\n\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: false,
      })
    })

    it('flags missing description when first non-blank line is a heading', () => {
      expect(inspectReadmeContent('# parse\n\n## Section\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: false,
      })
    })

    it('skips blank lines between H1 and description', () => {
      expect(inspectReadmeContent('# parse\n\n\n\nDescription line.\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })

    it('does not treat ## as an H1', () => {
      expect(inspectReadmeContent('## not-h1\n\nDescription.\n', 'parse')).toEqual({
        hasMatchingHeading: false,
        hasDescription: false,
      })
    })

    it('uses the first H1 it finds', () => {
      expect(inspectReadmeContent('# parse\n\nDescription.\n\n# other\n', 'parse')).toEqual({
        hasMatchingHeading: true,
        hasDescription: true,
      })
    })
  })

  ruleTester.run('lib-pkg-secondary-entry-readme', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries',
        code: jsonWithExports({ '.': './src/index.js', './foo': './src/foo/index.js' }),
        filename: createLibraryWorkspace({
          projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
          subpaths: ['foo'],
        }),
      },
      {
        name: 'skips application projects',
        code: jsonWithExports({ '.': './src/index.js', './foo': './src/foo/index.js' }),
        filename: createLibraryWorkspace({
          projectJson: APPLICATION_PROJECT_JSON,
          subpaths: ['foo'],
        }),
      },
      {
        name: 'passes when package.json has no exports field',
        code: JSON.stringify({ name: '@hyperfrontend/test' }, null, 2),
        filename: createLibraryWorkspace({ rawExports: null }),
      },
      {
        name: 'passes when exports is a string',
        code: jsonWithExports('./src/index.js'),
        filename: createLibraryWorkspace({ rawExports: './src/index.js' }),
      },
      {
        name: 'passes when only primary entry and package.json self-reference are declared',
        code: jsonWithExports({ '.': './src/index.js', './package.json': './package.json' }),
        filename: createLibraryWorkspace({
          rawExports: { '.': './src/index.js', './package.json': './package.json' },
        }),
      },
      {
        name: 'skips glob entries',
        code: jsonWithExports({ '.': './src/index.js', './*': './src/*.js' }),
        filename: createLibraryWorkspace({
          rawExports: { '.': './src/index.js', './*': './src/*.js' },
        }),
      },
      {
        name: 'skips bare keys without leading "./"',
        code: jsonWithExports({ foo: './src/foo/index.js' }),
        filename: createLibraryWorkspace({
          rawExports: { foo: './src/foo/index.js' },
        }),
      },
      {
        name: 'passes when README exists with H1 matching basename and a description',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: {
            'src/commits/parse/README.md': '# parse\n\nParses commits.\n',
          },
        }),
      },
      {
        name: 'passes for H1 capitalization, slash, and " Module" suffix variants',
        code: jsonWithExports({ '.': './src/index.js', './semver': './src/semver/index.js', './heuristics': './src/heuristics/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['semver', 'heuristics'],
          readmes: {
            'src/semver/README.md': '# semver/\n\nSemver utilities.\n',
            'src/heuristics/README.md': '# Heuristics Module\n\nDetects project signals.\n',
          },
        }),
      },
      {
        name: 'passes when README has additional sections beyond H1+description',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: {
            'src/commits/parse/README.md': '# parse\n\nParses commits.\n\n## Overview\n\nMore detail here.\n\n## Design\n\nDesign notes.\n',
          },
        }),
      },
      {
        name: 'ignores non-string exports keys',
        code: '{ "exports": { "1": "./src/foo/index.js" } }',
        filename: createLibraryWorkspace({
          rawExports: { '1': './src/foo/index.js' },
        }),
      },
      {
        name: 'ignores conditional-style nested exports values',
        code: jsonWithExports({ '.': { import: './src/index.mjs', require: './src/index.cjs' } }),
        filename: createLibraryWorkspace({
          rawExports: { '.': { import: './src/index.mjs', require: './src/index.cjs' } },
        }),
      },
    ],
    invalid: [
      {
        name: 'reports missing README for a secondary entry',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({ subpaths: ['commits/parse'] }),
        errors: [
          {
            messageId: 'missingSecondaryReadme',
            data: { subpath: 'commits/parse', expectedPath: 'src/commits/parse/README.md' },
          },
        ],
      },
      {
        name: 'reports missing heading when README is empty',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: { 'src/commits/parse/README.md': '' },
        }),
        errors: [
          {
            messageId: 'missingReadmeHeading',
            data: {
              subpath: 'commits/parse',
              expectedPath: 'src/commits/parse/README.md',
              moduleName: 'parse',
            },
          },
        ],
      },
      {
        name: 'reports missing heading when README has no H1',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: { 'src/commits/parse/README.md': 'Just some text without a heading.\n' },
        }),
        errors: [
          {
            messageId: 'missingReadmeHeading',
            data: {
              subpath: 'commits/parse',
              expectedPath: 'src/commits/parse/README.md',
              moduleName: 'parse',
            },
          },
        ],
      },
      {
        name: 'reports missing heading when H1 mismatches module name',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: { 'src/commits/parse/README.md': '# wrong-name\n\nDescription.\n' },
        }),
        errors: [
          {
            messageId: 'missingReadmeHeading',
            data: {
              subpath: 'commits/parse',
              expectedPath: 'src/commits/parse/README.md',
              moduleName: 'parse',
            },
          },
        ],
      },
      {
        name: 'reports missing description when README has H1 but nothing beneath',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: { 'src/commits/parse/README.md': '# parse\n' },
        }),
        errors: [
          {
            messageId: 'missingReadmeDescription',
            data: { subpath: 'commits/parse', expectedPath: 'src/commits/parse/README.md' },
          },
        ],
      },
      {
        name: 'reports missing description when first non-blank line after H1 is another heading',
        code: jsonWithExports({ '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse'],
          readmes: {
            'src/commits/parse/README.md': '# parse\n\n## Section\n\nNot a description.\n',
          },
        }),
        errors: [
          {
            messageId: 'missingReadmeDescription',
            data: { subpath: 'commits/parse', expectedPath: 'src/commits/parse/README.md' },
          },
        ],
      },
      {
        name: 'reports across multiple secondary entries within the same library',
        code: jsonWithExports({
          '.': './src/index.js',
          './commits/parse': './src/commits/parse/index.js',
          './semver/format': './src/semver/format/index.js',
        }),
        filename: createLibraryWorkspace({
          subpaths: ['commits/parse', 'semver/format'],
          readmes: { 'src/commits/parse/README.md': '# parse\n\nParses commits.\n' },
        }),
        errors: [
          {
            messageId: 'missingSecondaryReadme',
            data: { subpath: 'semver/format', expectedPath: 'src/semver/format/README.md' },
          },
        ],
      },
    ],
  })
})
