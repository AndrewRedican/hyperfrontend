import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, {
  buildCompatibilityDocument,
  collectMatrixLibraries,
  renderCompatibilityDocument,
  RULE_NAME,
} from './lib-compatibility-matrix'

const manager = createTempWorkspaceManager()

/**
 * A library planted in a temporary workspace for one test.
 */
interface LibraryFixture {
  /** Path of the library directory, relative to the workspace root. */
  path: string
  /** Content written to the library's project.json. */
  projectJson: object
  /** Content written to the library's package.json, omitted to leave the file out. */
  packageJson?: object
}

/**
 * Options for the publishable project.json helper.
 */
interface ProjectConfig {
  /** Nx project name. */
  name: string
  /** Value placed under `metadata.compatibility`. */
  compatibility?: object
  /** Value placed under `targets.build.options`. */
  buildOptions?: object
}

/**
 * Builds a publishable project.json for a fixture library.
 *
 * @param config - What the project declares.
 * @returns The project.json content.
 */
function publishableProject(config: ProjectConfig): object {
  return {
    name: config.name,
    projectType: 'library',
    metadata: config.compatibility ? { compatibility: config.compatibility } : undefined,
    targets: {
      build: { options: config.buildOptions ?? { esm: {}, cjs: {} } },
      publish: {},
    },
  }
}

/**
 * Creates a temporary workspace holding the given libraries.
 *
 * @param libraries - Libraries to plant.
 * @param extraFiles - Extra files keyed by workspace-relative path.
 * @returns The absolute path to the workspace root.
 */
function createWorkspace(libraries: LibraryFixture[], extraFiles: Record<string, string> = {}): string {
  const files: Record<string, string> = { 'nx.json': stringify({ version: 2 }, null, 2), ...extraFiles }

  for (const library of libraries) {
    files[`${library.path}/project.json`] = stringify(library.projectJson, null, 2)

    if (library.packageJson) {
      files[`${library.path}/package.json`] = stringify(library.packageJson, null, 2)
    }
  }

  return manager.create({ files }).root
}

/**
 * What the stub fixer records when the rule's fix runs.
 */
interface AppliedFix {
  /** Range the fix replaces. */
  range: number[]
  /** Text the fix writes in its place. */
  text: string
}

/**
 * Stand-in for the ESLint fixer, handing back what it was asked to write.
 */
interface FixerStub {
  /** Records a replacement of the given range. */
  replaceTextRange: (range: number[], text: string) => AppliedFix
}

/**
 * The parts of a report descriptor these tests read back.
 */
interface ReportedProblem {
  /** Message identifier the rule reported. */
  messageId: string
  /** Fix the rule attached to the report. */
  fix: (fixer: FixerStub) => AppliedFix
}

/**
 * Runs the rule against a document and returns everything it reported.
 *
 * @param workspaceRoot - Workspace the document belongs to.
 * @param content - Content the document holds on disk.
 * @returns The reported problems, in report order.
 */
function lintDocument(workspaceRoot: string, content: string): ReportedProblem[] {
  const reportMock = jest.fn()
  const context = {
    filename: join(workspaceRoot, 'LIBRARY_COMPATIBILITY.md'),
    sourceCode: { getText: () => content },
    report: reportMock,
  }
  // @ts-expect-error - partial mock
  const handler = rule.create(context)
  const mockNode = { type: 'root' }
  // @ts-expect-error - partial mock
  handler['root']?.(mockNode)

  return reportMock.mock.calls.map((call) => call[0] as ReportedProblem)
}

/**
 * Extracts the section of the generated document under a heading.
 *
 * @param document - The generated document.
 * @param heading - Heading that opens the section.
 * @returns The section text, without the heading itself.
 */
function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(heading)
  const rest = document.slice(start + heading.length)
  const end = rest.indexOf('\n## ')

  return end === -1 ? rest : rest.slice(0, end)
}

describe('lib-compatibility-matrix', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-compatibility-matrix')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('declares itself fixable as code', () => {
      expect(rule.meta?.fixable).toBe('code')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('lib-compatibility-matrix')
    })

    it('has all required message IDs', () => {
      const messageIds = keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('staleMatrix')
    })

    it('tells the reader how to regenerate the document', () => {
      expect(rule.meta?.messages?.['staleMatrix']).toContain('npx nx lint:all')
    })
  })

  describe('collectMatrixLibraries', () => {
    it('collects publishable libraries from libs and plugins sorted by package name', () => {
      const root = createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({ name: 'lib-logging' }),
          packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
        },
        {
          path: 'plugins/features',
          projectJson: publishableProject({ name: 'plugin-features' }),
          packageJson: { name: '@hyperfrontend/features', version: '0.1.0' },
        },
      ])

      const libraries = collectMatrixLibraries(root)

      expect(libraries.map((library) => library.packageName)).toEqual(['@hyperfrontend/features', '@hyperfrontend/logging'])
    })

    it('finds libraries nested below the scanned folder', () => {
      const root = createWorkspace([
        {
          path: 'libs/utils/json',
          projectJson: publishableProject({ name: 'lib-json-utils' }),
          packageJson: { name: '@hyperfrontend/json-utils', version: '1.0.0' },
        },
      ])

      const libraries = collectMatrixLibraries(root)

      expect(libraries.length).toBe(1)
      expect(libraries[0]?.shortName).toBe('json-utils')
    })

    it('ignores projects without a publish target', () => {
      const root = createWorkspace([
        {
          path: 'libs/internal',
          projectJson: { name: 'lib-internal', projectType: 'library', targets: { build: {} } },
          packageJson: { name: '@hyperfrontend/internal', version: '1.0.0' },
        },
      ])

      expect(collectMatrixLibraries(root)).toEqual([])
    })

    it('ignores libraries without a package.json', () => {
      const root = createWorkspace([
        {
          path: 'libs/no-package',
          projectJson: publishableProject({ name: 'lib-no-package' }),
        },
      ])

      expect(collectMatrixLibraries(root)).toEqual([])
    })

    it('ignores libraries whose package.json declares no name', () => {
      const root = createWorkspace([
        {
          path: 'libs/anonymous',
          projectJson: publishableProject({ name: 'lib-anonymous' }),
          packageJson: { version: '1.0.0' },
        },
      ])

      expect(collectMatrixLibraries(root)).toEqual([])
    })

    it('returns an empty list when neither scanned folder exists', () => {
      const root = manager.create({ files: { 'nx.json': stringify({ version: 2 }, null, 2) } }).root

      expect(collectMatrixLibraries(root)).toEqual([])
    })

    it('never descends into node_modules, dist or dot directories', () => {
      const root = createWorkspace(
        [
          {
            path: 'libs/node_modules/vendored',
            projectJson: publishableProject({ name: 'vendored' }),
            packageJson: { name: '@hyperfrontend/vendored', version: '1.0.0' },
          },
          {
            path: 'libs/dist/emitted',
            projectJson: publishableProject({ name: 'emitted' }),
            packageJson: { name: '@hyperfrontend/emitted', version: '1.0.0' },
          },
          {
            path: 'libs/.cache/cached',
            projectJson: publishableProject({ name: 'cached' }),
            packageJson: { name: '@hyperfrontend/cached', version: '1.0.0' },
          },
        ],
        { 'libs/stray.txt': 'not a directory' }
      )

      expect(collectMatrixLibraries(root)).toEqual([])
    })

    it('reads the declared support level for each environment', () => {
      const root = createWorkspace([
        {
          path: 'libs/ui',
          projectJson: publishableProject({
            name: 'lib-ui-utils',
            compatibility: { environments: { node: 'partial', browser: 'full', webWorker: 'none' }, note: 'Browser first.' },
          }),
          packageJson: { name: '@hyperfrontend/ui-utils', version: '0.0.8' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.environments).toEqual({ node: 'partial', browser: 'full', webWorker: 'none' })
      expect(library?.note).toBe('Browser first.')
    })

    it('leaves every environment undeclared when project.json carries no compatibility metadata', () => {
      const root = createWorkspace([
        {
          path: 'libs/undeclared',
          projectJson: publishableProject({ name: 'lib-undeclared' }),
          packageJson: { name: '@hyperfrontend/undeclared', version: '1.0.0' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.environments).toEqual({ node: null, browser: null, webWorker: null })
      expect(library?.note).toBe(null)
    })

    it('treats an unrecognised support level as undeclared', () => {
      const root = createWorkspace([
        {
          path: 'libs/odd',
          projectJson: publishableProject({
            name: 'lib-odd',
            compatibility: { environments: { node: 'maybe', browser: 'full' } },
          }),
          packageJson: { name: '@hyperfrontend/odd', version: '1.0.0' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.environments).toEqual({ node: null, browser: 'full', webWorker: null })
    })

    it('reads output formats from the build options', () => {
      const root = createWorkspace([
        {
          path: 'libs/bundled',
          projectJson: publishableProject({
            name: 'lib-bundled',
            buildOptions: { esm: {}, cjs: {}, iife: { entry: '.', globalName: 'Bundled' }, umd: { entry: '.', globalName: 'Bundled' } },
          }),
          packageJson: { name: '@hyperfrontend/bundled', version: '1.0.0' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.formats).toEqual({ esm: true, cjs: true, iife: true, umd: true })
      expect(library?.globalNames).toEqual(['Bundled'])
    })

    it('reads a global name from every entry of a multi-bundle configuration', () => {
      const root = createWorkspace([
        {
          path: 'libs/multi',
          projectJson: publishableProject({
            name: 'lib-multi',
            buildOptions: {
              esm: {},
              iife: [{ entry: './host', globalName: 'Host' }, { entry: './hostee', globalName: 'Hostee' }, { entry: './debug' }],
              umd: [{ entry: './host', globalName: 'Host' }],
            },
          }),
          packageJson: { name: '@hyperfrontend/multi', version: '1.0.0' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.globalNames).toEqual(['Host', 'Hostee'])
      expect(library?.formats).toEqual({ esm: true, cjs: false, iife: true, umd: true })
    })

    it('collects first-party dependencies and marks peer dependencies', () => {
      const root = createWorkspace([
        {
          path: 'libs/nexus',
          projectJson: publishableProject({ name: 'lib-nexus' }),
          packageJson: {
            name: '@hyperfrontend/nexus',
            version: '3.0.0',
            dependencies: { '@hyperfrontend/logging': '1.0.0', tslib: '2.8.1' },
            peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0', typescript: '5.9.3' },
          },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.dependencies).toEqual([
        { packageName: '@hyperfrontend/logging', peer: false },
        { packageName: '@hyperfrontend/network-protocol', peer: true },
      ])
    })

    it('reads engines and version from package.json', () => {
      const root = createWorkspace([
        {
          path: 'libs/engined',
          projectJson: publishableProject({ name: 'lib-engined' }),
          packageJson: { name: '@hyperfrontend/engined', version: '2.1.0', engines: { node: '>=18.0.0', npm: '>=8.0.0' } },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.version).toBe('2.1.0')
      expect(library?.nodeEngine).toBe('>=18.0.0')
      expect(library?.npmEngine).toBe('>=8.0.0')
    })

    it('leaves version and engines unset when package.json declares none', () => {
      const root = createWorkspace([
        {
          path: 'libs/bare',
          projectJson: publishableProject({ name: 'lib-bare' }),
          packageJson: { name: '@hyperfrontend/bare' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.version).toBe(null)
      expect(library?.nodeEngine).toBe(null)
      expect(library?.npmEngine).toBe(null)
    })

    it('keeps both rows when two directories declare the same package name', () => {
      const root = createWorkspace([
        {
          path: 'libs/first',
          projectJson: publishableProject({ name: 'lib-first' }),
          packageJson: { name: '@hyperfrontend/twin', version: '1.0.0' },
        },
        {
          path: 'libs/second',
          projectJson: publishableProject({ name: 'lib-second' }),
          packageJson: { name: '@hyperfrontend/twin', version: '2.0.0' },
        },
      ])

      const libraries = collectMatrixLibraries(root)

      expect(libraries.length).toBe(2)
      expect(libraries[0]?.packageName).toBe('@hyperfrontend/twin')
      expect(libraries[1]?.packageName).toBe('@hyperfrontend/twin')
    })

    it('treats a build target without options as shipping no format', () => {
      const root = createWorkspace([
        {
          path: 'libs/optionless',
          projectJson: { name: 'lib-optionless', projectType: 'library', targets: { build: {}, publish: {} } },
          packageJson: { name: '@hyperfrontend/optionless', version: '1.0.0' },
        },
      ])

      const library = collectMatrixLibraries(root)[0]

      expect(library?.formats).toEqual({ esm: false, cjs: false, iife: false, umd: false })
      expect(library?.globalNames).toEqual([])
    })
  })

  describe('renderCompatibilityDocument', () => {
    const workspaceWithTwoLibraries = (): string =>
      createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({
            name: 'lib-logging',
            compatibility: { environments: { node: 'full', browser: 'full', webWorker: 'full' } },
            buildOptions: {
              esm: {},
              cjs: {},
              iife: { entry: '.', globalName: 'HyperfrontendLogging' },
              umd: { entry: '.', globalName: 'HyperfrontendLogging' },
            },
          }),
          packageJson: {
            name: '@hyperfrontend/logging',
            version: '1.0.0',
            engines: { node: '>=18.0.0', npm: '>=8.0.0' },
            dependencies: { '@hyperfrontend/data-utils': '1.0.0' },
          },
        },
        {
          path: 'libs/utils/data',
          projectJson: publishableProject({
            name: 'lib-data-utils',
            compatibility: { environments: { node: 'full', browser: 'partial', webWorker: 'none' }, note: 'Reads DOM ranges.' },
          }),
          packageJson: { name: '@hyperfrontend/data-utils', version: '1.0.0', engines: { node: '>=18.0.0' } },
        },
      ])

    it('opens with the title and the generated-document note', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const lines = document.split('\n')

      expect(lines[0]).toBe('# Library Compatibility Matrix')
      expect(lines[2]).toContain('> Generated from each')
      expect(lines[2]).toContain('npx nx lint:all')
    })

    it('carries no date stamp', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document).not.toContain('Last updated')
    })

    it('renders every section in order', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const headings = document.split('\n').filter((line) => line.startsWith('## '))

      expect(headings).toEqual([
        '## Platform Support',
        '## Output Formats',
        '## Engine Requirements',
        '## Dependency Graph',
        '## Published Versions',
      ])
    })

    it('renders one platform row per library with a glyph per environment', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const platform = sectionOf(document, '## Platform Support')

      expect(platform).toContain('| Library | Node.js | Browser | Web Worker | CDN Bundle |')
      expect(platform).toContain('| `@hyperfrontend/data-utils` | ✅ | ⚠️ | ❌ | ❌ |')
      expect(platform).toContain('| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ |')
    })

    it('explains the glyphs below the platform table', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document).toContain('Legend: ✅ full support, ⚠️ partial support, ❌ no support, ❓ nothing declared.')
    })

    it('renders an unknown glyph for a library that declares no compatibility', () => {
      const root = createWorkspace([
        {
          path: 'libs/undeclared',
          projectJson: publishableProject({ name: 'lib-undeclared' }),
          packageJson: { name: '@hyperfrontend/undeclared', version: '1.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/undeclared` | ❓ | ❓ | ❓ | ❌ |')
    })

    it('marks a CDN bundle when only a UMD build is configured', () => {
      const root = createWorkspace([
        {
          path: 'libs/umd-only',
          projectJson: publishableProject({ name: 'lib-umd-only', buildOptions: { umd: { entry: '.', globalName: 'UmdOnly' } } }),
          packageJson: { name: '@hyperfrontend/umd-only', version: '1.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/umd-only` | ❓ | ❓ | ❓ | ✅ |')
    })

    it('lists a note for every library that declares one', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document).toContain('**Notes**')
      expect(document).toContain('- `@hyperfrontend/data-utils`: Reads DOM ranges.')
      expect(document).not.toContain('- `@hyperfrontend/logging`:')
    })

    it('omits the notes block when no library declares a note', () => {
      const root = createWorkspace([
        {
          path: 'libs/quiet',
          projectJson: publishableProject({ name: 'lib-quiet' }),
          packageJson: { name: '@hyperfrontend/quiet', version: '1.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).not.toContain('**Notes**')
    })

    it('renders the output format table with the bundle global names', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const formats = sectionOf(document, '## Output Formats')

      expect(formats).toContain('| Library | ESM | CJS | IIFE | UMD | Global name |')
      expect(formats).toContain('| `@hyperfrontend/data-utils` | ✅ | ✅ | ❌ | ❌ | - |')
      expect(formats).toContain('| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendLogging` |')
    })

    it('joins several global names into one cell', () => {
      const root = createWorkspace([
        {
          path: 'libs/multi',
          projectJson: publishableProject({
            name: 'lib-multi',
            buildOptions: {
              iife: [
                { entry: './host', globalName: 'Host' },
                { entry: './hostee', globalName: 'Hostee' },
              ],
            },
          }),
          packageJson: { name: '@hyperfrontend/multi', version: '1.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('| `Host`, `Hostee` |')
    })

    it('renders the engine table and a dash where an engine is undeclared', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const engines = sectionOf(document, '## Engine Requirements')

      expect(engines).toContain('| Library | Node.js | npm |')
      expect(engines).toContain('| `@hyperfrontend/data-utils` | `>=18.0.0` | - |')
      expect(engines).toContain('| `@hyperfrontend/logging` | `>=18.0.0` | `>=8.0.0` |')
    })

    it('renders the dependency table with a dash for a library that depends on nothing first-party', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const dependencies = sectionOf(document, '## Dependency Graph')

      expect(dependencies).toContain('| Library | Depends on |')
      expect(dependencies).toContain('| `@hyperfrontend/data-utils` | - |')
      expect(dependencies).toContain('| `@hyperfrontend/logging` | `@hyperfrontend/data-utils` |')
    })

    it('marks a peer dependency in the dependency table', () => {
      const root = createWorkspace([
        {
          path: 'libs/nexus',
          projectJson: publishableProject({ name: 'lib-nexus' }),
          packageJson: {
            name: '@hyperfrontend/nexus',
            version: '3.0.0',
            peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0' },
          },
        },
        {
          path: 'libs/network-protocol',
          projectJson: publishableProject({ name: 'lib-network-protocol' }),
          packageJson: { name: '@hyperfrontend/network-protocol', version: '2.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/nexus` | `@hyperfrontend/network-protocol` (peer) |')
    })

    it('draws the dependency diagram in a fenced mermaid block with a theme config', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document).toContain('```mermaid')
      expect(document).toContain('config:\n  theme: base')
      expect(document).toContain('flowchart TB')
    })

    it('gives every node an identifier free of hyphens', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document).toContain('    data_utils["data-utils"]')
      expect(document).toContain('    logging["logging"]')
      expect(document).toContain('    logging --> data_utils')
    })

    it('draws a peer dependency as a dotted edge', () => {
      const root = createWorkspace([
        {
          path: 'libs/nexus',
          projectJson: publishableProject({ name: 'lib-nexus' }),
          packageJson: {
            name: '@hyperfrontend/nexus',
            version: '3.0.0',
            peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0' },
          },
        },
        {
          path: 'libs/network-protocol',
          projectJson: publishableProject({ name: 'lib-network-protocol' }),
          packageJson: { name: '@hyperfrontend/network-protocol', version: '2.0.0' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('    nexus -.-> network_protocol')
    })

    it('omits a diagram edge to a package the matrix does not document', () => {
      const root = createWorkspace([
        {
          path: 'libs/consumer',
          projectJson: publishableProject({ name: 'lib-consumer' }),
          packageJson: {
            name: '@hyperfrontend/consumer',
            version: '1.0.0',
            dependencies: { '@hyperfrontend/absent': '1.0.0' },
          },
        },
      ])

      const document = buildCompatibilityDocument(root)

      expect(document).toContain('| `@hyperfrontend/consumer` | `@hyperfrontend/absent` |')
      expect(document).not.toContain('consumer --> absent')
    })

    it('renders the published version table', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const versions = sectionOf(document, '## Published Versions')

      expect(versions).toContain('| Library | Version |')
      expect(versions).toContain('| `@hyperfrontend/logging` | `1.0.0` |')
    })

    it('renders a dash for a library with no published version', () => {
      const root = createWorkspace([
        {
          path: 'libs/bare',
          projectJson: publishableProject({ name: 'lib-bare' }),
          packageJson: { name: '@hyperfrontend/bare' },
        },
      ])

      expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/bare` | - |')
    })

    it('ends with exactly one trailing newline', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

      expect(document.endsWith('\n')).toBe(true)
      expect(document.endsWith('\n\n')).toBe(false)
    })

    it('uses no em dash anywhere', () => {
      expect(buildCompatibilityDocument(workspaceWithTwoLibraries())).not.toContain('—')
    })

    it('gives every fenced block a language', () => {
      const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
      const fences = document.split('\n').filter((line) => line.startsWith('```'))

      expect(fences).toEqual(['```mermaid', '```'])
    })

    it('renders headers only when the workspace holds no publishable library', () => {
      const document = renderCompatibilityDocument([])

      expect(document).toContain('| Library | Node.js | Browser | Web Worker | CDN Bundle |')
      expect(document).not.toContain('| `@hyperfrontend/')
      expect(document).toContain('flowchart TB\n```')
    })

    it('escapes a pipe inside a table cell', () => {
      const document = renderCompatibilityDocument([
        {
          packageName: '@hyperfrontend/piped',
          shortName: 'piped',
          version: '1.0.0 | beta',
          nodeEngine: null,
          npmEngine: null,
          environments: { node: 'full', browser: 'none', webWorker: 'none' },
          note: null,
          formats: { esm: true, cjs: true, iife: false, umd: false },
          globalNames: [],
          dependencies: [],
        },
      ])

      expect(document).toContain('| `1.0.0 \\| beta` |')
    })
  })

  describe('rule behavior', () => {
    it('ignores files that are not LIBRARY_COMPATIBILITY.md', () => {
      const handler = rule.create({
        filename: '/some/path/README.md',
        sourceCode: { getText: () => '' },
      } as never)

      expect(handler).toEqual({})
    })

    it('ignores a compatibility document outside the workspace root', () => {
      const root = createWorkspace([])

      const handler = rule.create({
        filename: join(root, 'libs', 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: { getText: () => '# Some content' },
      } as never)

      expect(handler).toEqual({})
    })

    it('ignores a compatibility document with no workspace above it', () => {
      const orphan = manager.create({ files: { 'notes.txt': 'no workspace marker here' } }).root

      const handler = rule.create({
        filename: join(orphan, 'LIBRARY_COMPATIBILITY.md'),
        sourceCode: { getText: () => '# Some content' },
      } as never)

      expect(handler).toEqual({})
    })

    it('reports nothing when the document matches what the workspace declares', () => {
      const root = createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({ name: 'lib-logging' }),
          packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
        },
      ])

      expect(lintDocument(root, buildCompatibilityDocument(root))).toEqual([])
    })

    it('reports a stale matrix when the document drifted from the workspace', () => {
      const root = createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({ name: 'lib-logging' }),
          packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
        },
      ])

      const reported = lintDocument(root, '# Library Compatibility Matrix\n\nHand written.\n')

      expect(reported.length).toBe(1)
      expect(reported[0]?.messageId).toBe('staleMatrix')
    })

    it('reports a stale matrix when a single version drifted', () => {
      const root = createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({ name: 'lib-logging' }),
          packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
        },
      ])
      const drifted = buildCompatibilityDocument(root).replace('`1.0.0`', '`0.0.1`')

      expect(lintDocument(root, drifted).length).toBe(1)
    })

    it('fixes the document by replacing all of it with the derived text', () => {
      const root = createWorkspace([
        {
          path: 'libs/logging',
          projectJson: publishableProject({ name: 'lib-logging' }),
          packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
        },
      ])
      const drifted = '# Library Compatibility Matrix\n\nHand written.\n'

      const reported = lintDocument(root, drifted)
      const fix = reported[0]?.fix({ replaceTextRange: (range: number[], text: string) => ({ range, text }) })

      expect(fix?.range).toEqual([0, drifted.length])
      expect(fix?.text).toBe(buildCompatibilityDocument(root))
    })
  })
})
