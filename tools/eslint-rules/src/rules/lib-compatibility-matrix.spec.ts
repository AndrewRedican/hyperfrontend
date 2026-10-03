import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { buildCompatibilityDocument } from '@hyperfrontend/workspace'
import { createTempWorkspaceManager } from '../testing'
import rule, { RULE_NAME } from './lib-compatibility-matrix'

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
