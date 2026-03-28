import { join } from 'node:path'
import { createTempWorkspaceManager } from '../testing'
import rule, { deriveCoverageFlag, hasCoverageEntry, hasMatrixEntry, hasPathFilter, hasStatusWorkflow, RULE_NAME } from './lib-ci-workflows'

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
 * @param config.workflows - Workflow file configurations.
 * @param config.workflows.ciLibraries - Content for ci-libraries.yml.
 * @param config.workflows.ciMain - Content for ci-main.yml.
 * @param config.workflows.statusWorkflows - Array of status workflow filenames to create.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: {
  libs?: Array<{ name: string; folderName?: string; projectJson: object }>
  workflows?: {
    ciLibraries?: string
    ciMain?: string
    statusWorkflows?: string[]
  }
}): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
  }

  // Create libs directory and libraries
  if (config.libs && config.libs.length > 0) {
    for (const lib of config.libs) {
      const folderName = lib.folderName ?? lib.name
      files[`libs/${folderName}/project.json`] = JSON.stringify(lib.projectJson, null, 2)
    }
  }

  // Create ci-libraries.yml if provided
  if (config.workflows?.ciLibraries !== undefined) {
    files['.github/workflows/ci-libraries.yml'] = config.workflows.ciLibraries
  }

  // Create ci-main.yml if provided
  if (config.workflows?.ciMain !== undefined) {
    files['.github/workflows/ci-main.yml'] = config.workflows.ciMain
  }

  // Create status workflow files
  if (config.workflows?.statusWorkflows) {
    for (const workflowName of config.workflows.statusWorkflows) {
      files[`.github/workflows/${workflowName}`] = '# Status workflow'
    }
  }

  const workspace = manager.create({ files })
  return workspace.root
}

/**
 * Creates valid ci-libraries.yml content for a set of libraries.
 *
 * @param libraries - Array of library configurations.
 * @returns The ci-libraries.yml content.
 */
function createCiLibrariesContent(libraries: Array<{ flag: string; path: string; projectName: string }>): string {
  const filters = libraries.map((lib) => `            ${lib.flag}:\n              - '${lib.path}/**'`).join('\n')

  const matrixEntries = libraries
    .map((lib) => `          add_if_changed "\${{ steps.filter.outputs.${lib.flag} }}" "${lib.projectName}" "${lib.path}" "${lib.flag}"`)
    .join('\n')

  return `name: libraries

on:
  push:
    branches: [main]

jobs:
  detect-changes:
    steps:
      - name: Detect changed libraries
        id: filter
        uses: dorny/paths-filter@v3
        with:
          filters: |
${filters}

      - name: Build matrix from filter outputs
        id: set-matrix
        shell: bash
        run: |
${matrixEntries}
`
}

/**
 * Creates valid ci-main.yml content for a set of libraries.
 *
 * @param libraries - Array of library configurations.
 * @returns The ci-main.yml content.
 */
function createCiMainContent(libraries: Array<{ flag: string; path: string }>): string {
  const libsArray = libraries.map((lib) => `            "${lib.flag}:${lib.path}"`).join('\n')

  return `name: CI Main

jobs:
  test:
    steps:
      - name: Upload library coverage to Codecov
        run: |
          LIBS=(
${libsArray}
          )
`
}

describe('lib-ci-workflows', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-ci-workflows')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('lib-ci-workflows')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingPathFilter')
      expect(messageIds).toContain('missingMatrixEntry')
      expect(messageIds).toContain('missingStatusWorkflow')
      expect(messageIds).toContain('missingCoverageEntry')
      expect(messageIds).toContain('missingCiLibrariesFile')
      expect(messageIds).toContain('missingCiMainFile')
    })
  })

  describe('deriveCoverageFlag', () => {
    it('derives flag from simple library path', () => {
      expect(deriveCoverageFlag('libs/network-protocol')).toBe('network-protocol')
    })

    it('derives flag from nested utils path', () => {
      expect(deriveCoverageFlag('libs/utils/json')).toBe('json-utils')
    })

    it('derives flag from plugins path', () => {
      expect(deriveCoverageFlag('plugins/features')).toBe('features')
    })

    it('handles deeply nested utils', () => {
      expect(deriveCoverageFlag('libs/utils/random-generator')).toBe('random-generator-utils')
    })

    it('handles simple paths', () => {
      expect(deriveCoverageFlag('libs/cryptography')).toBe('cryptography')
    })
  })

  describe('hasPathFilter', () => {
    it('returns true when path filter exists', () => {
      const content = `filters: |
            cryptography:
              - 'libs/cryptography/**'`

      expect(hasPathFilter(content, 'cryptography', 'libs/cryptography')).toBe(true)
    })

    it('returns false when path filter is missing', () => {
      const content = `filters: |
            logging:
              - 'libs/logging/**'`

      expect(hasPathFilter(content, 'cryptography', 'libs/cryptography')).toBe(false)
    })

    it('handles nested utils paths', () => {
      const content = `filters: |
            json-utils:
              - 'libs/utils/json/**'`

      expect(hasPathFilter(content, 'json-utils', 'libs/utils/json')).toBe(true)
    })

    it('returns false for partial matches', () => {
      const content = `filters: |
            cryptography:
              - 'libs/cryptography/**'`

      expect(hasPathFilter(content, 'crypto', 'libs/crypto')).toBe(false)
    })
  })

  describe('hasMatrixEntry', () => {
    it('returns true when matrix entry exists', () => {
      const content = `add_if_changed "\${{ steps.filter.outputs.cryptography }}" "lib-cryptography" "libs/cryptography" "cryptography"`

      expect(hasMatrixEntry(content, 'lib-cryptography', 'cryptography', 'libs/cryptography')).toBe(true)
    })

    it('returns false when matrix entry is missing', () => {
      const content = `add_if_changed "\${{ steps.filter.outputs.logging }}" "lib-logging" "libs/logging" "logging"`

      expect(hasMatrixEntry(content, 'lib-cryptography', 'cryptography', 'libs/cryptography')).toBe(false)
    })

    it('ignores commented entries', () => {
      const content = `# add_if_changed "\${{ steps.filter.outputs.cryptography }}" "lib-cryptography" "libs/cryptography" "cryptography"`

      expect(hasMatrixEntry(content, 'lib-cryptography', 'cryptography', 'libs/cryptography')).toBe(false)
    })

    it('handles nested utils paths', () => {
      const content = `add_if_changed "\${{ steps.filter.outputs.json-utils }}" "lib-json-utils" "libs/utils/json" "json-utils"`

      expect(hasMatrixEntry(content, 'lib-json-utils', 'json-utils', 'libs/utils/json')).toBe(true)
    })
  })

  describe('hasStatusWorkflow', () => {
    it('returns true when status workflow exists', () => {
      const workspaceDir = createTempWorkspace({
        workflows: {
          statusWorkflows: ['ci-lib-cryptography.yml'],
        },
      })

      expect(hasStatusWorkflow(workspaceDir, 'lib-cryptography')).toBe(true)
    })

    it('returns false when status workflow is missing', () => {
      const workspaceDir = createTempWorkspace({
        workflows: {},
      })

      expect(hasStatusWorkflow(workspaceDir, 'lib-cryptography')).toBe(false)
    })
  })

  describe('hasCoverageEntry', () => {
    it('returns true when coverage entry exists', () => {
      const content = `LIBS=(
            "cryptography:libs/cryptography"
          )`

      expect(hasCoverageEntry(content, 'cryptography', 'libs/cryptography')).toBe(true)
    })

    it('returns false when coverage entry is missing', () => {
      const content = `LIBS=(
            "logging:libs/logging"
          )`

      expect(hasCoverageEntry(content, 'cryptography', 'libs/cryptography')).toBe(false)
    })

    it('handles nested utils paths', () => {
      const content = `LIBS=(
            "json-utils:libs/utils/json"
          )`

      expect(hasCoverageEntry(content, 'json-utils', 'libs/utils/json')).toBe(true)
    })
  })

  describe('rule behavior', () => {
    it('ignores non ci-libraries.yml files', () => {
      const handler = rule.create({
        filename: '/some/path/ci-main.yml',
        sourceCode: { getText: () => '' },
      } as never)

      expect(handler).toEqual({})
    })

    it('ignores ci-libraries.yml not in .github/workflows', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'other/ci-libraries.yml': 'name: test',
        },
      })

      const handler = rule.create({
        filename: join(workspace.root, 'other', 'ci-libraries.yml'),
        sourceCode: { getText: () => 'name: test' },
      } as never)

      expect(handler).toEqual({})
    })

    it('passes when all publishable libraries have complete CI/CD config', () => {
      const libs = [{ flag: 'test-lib', path: 'libs/test-lib', projectName: 'lib-test-lib' }]

      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-test-lib',
            folderName: 'test-lib',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-test-lib' },
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent(libs),
          ciMain: createCiMainContent(libs),
          statusWorkflows: ['ci-lib-test-lib.yml'],
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')
      const ciLibrariesContent = createCiLibrariesContent(libs)

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => ciLibrariesContent },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      // Execute the Program handler
      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors).toHaveLength(0)
    })

    it('reports missing path filter', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-missing',
            folderName: 'missing',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-missing' },
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent([]), // No path filter
          ciMain: createCiMainContent([{ flag: 'missing', path: 'libs/missing' }]),
          statusWorkflows: ['ci-lib-missing.yml'],
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors.some((e) => e.messageId === 'missingPathFilter')).toBe(true)
    })

    it('reports missing matrix entry', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-no-matrix',
            folderName: 'no-matrix',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-no-matrix' },
          },
        ],
        workflows: {
          // Has path filter but no matrix entry
          ciLibraries: `filters: |
            no-matrix:
              - 'libs/no-matrix/**'`,
          ciMain: createCiMainContent([{ flag: 'no-matrix', path: 'libs/no-matrix' }]),
          statusWorkflows: ['ci-lib-no-matrix.yml'],
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: {
          getText: () => `filters: |
            no-matrix:
              - 'libs/no-matrix/**'`,
        },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors.some((e) => e.messageId === 'missingMatrixEntry')).toBe(true)
    })

    it('reports missing status workflow', () => {
      const libs = [{ flag: 'no-status', path: 'libs/no-status', projectName: 'lib-no-status' }]

      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-no-status',
            folderName: 'no-status',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-no-status' },
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent(libs),
          ciMain: createCiMainContent(libs),
          statusWorkflows: [], // No status workflow
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent(libs) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors.some((e) => e.messageId === 'missingStatusWorkflow')).toBe(true)
    })

    it('reports missing coverage entry', () => {
      const libs = [{ flag: 'no-coverage', path: 'libs/no-coverage', projectName: 'lib-no-coverage' }]

      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-no-coverage',
            folderName: 'no-coverage',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-no-coverage' },
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent(libs),
          ciMain: createCiMainContent([]), // No coverage entry
          statusWorkflows: ['ci-lib-no-coverage.yml'],
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent(libs) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors.some((e) => e.messageId === 'missingCoverageEntry')).toBe(true)
    })

    it('reports missing ci-main.yml file', () => {
      const libs = [{ flag: 'test-lib', path: 'libs/test-lib', projectName: 'lib-test-lib' }]

      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-test-lib',
            folderName: 'test-lib',
            projectJson: { ...PUBLISHABLE_PROJECT_JSON, name: 'lib-test-lib' },
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent(libs),
          // No ciMain file
          statusWorkflows: ['ci-lib-test-lib.yml'],
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent(libs) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors.some((e) => e.messageId === 'missingCiMainFile')).toBe(true)
    })

    it('ignores non-publishable libraries', () => {
      const workspaceDir = createTempWorkspace({
        libs: [
          {
            name: 'lib-internal',
            folderName: 'internal',
            projectJson: NON_PUBLISHABLE_PROJECT_JSON, // No publish target
          },
        ],
        workflows: {
          ciLibraries: createCiLibrariesContent([]), // Empty - no CI needed
          ciMain: createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspaceDir, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report any errors for non-publishable libraries
      expect(errors).toHaveLength(0)
    })

    it('handles utils nested path correctly', () => {
      const libs = [{ flag: 'json-utils', path: 'libs/utils/json', projectName: 'lib-json-utils' }]

      // Create workspace with nested utils structure
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/utils/json/project.json': JSON.stringify({ ...PUBLISHABLE_PROJECT_JSON, name: 'lib-json-utils' }, null, 2),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent(libs),
          '.github/workflows/ci-main.yml': createCiMainContent(libs),
          '.github/workflows/ci-lib-json-utils.yml': '# Status workflow',
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent(libs) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      expect(errors).toHaveLength(0)
    })

    it('handles single-segment path in deriveCoverageFlag', () => {
      // Edge case: single segment path
      expect(deriveCoverageFlag('mylib')).toBe('mylib')
    })

    it('ignores libraries with no project.json', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
        directories: ['libs/no-project-json'],
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report errors for directories without project.json
      expect(errors).toHaveLength(0)
    })

    it('ignores libraries with invalid project.json', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/invalid-json/project.json': 'not valid json {{{',
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report errors for libraries with invalid project.json
      expect(errors).toHaveLength(0)
    })

    it('ignores application projects', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/app-project/project.json': JSON.stringify({
            name: 'app-project',
            projectType: 'application',
            targets: { build: {}, publish: {} },
          }),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report errors for application projects
      expect(errors).toHaveLength(0)
    })

    it('ignores libraries without build target', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/no-build/project.json': JSON.stringify({
            name: 'lib-no-build',
            projectType: 'library',
            targets: { publish: {} }, // No build target
          }),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report errors for libraries without build target
      expect(errors).toHaveLength(0)
    })

    it('skips hidden directories', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/.hidden-lib/project.json': JSON.stringify(PUBLISHABLE_PROJECT_JSON),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should not report errors for hidden directories
      expect(errors).toHaveLength(0)
    })

    it('uses fallback name when project.json has no name', () => {
      const workspace = manager.create({
        files: {
          'nx.json': JSON.stringify({ version: 2 }, null, 2),
          'libs/unnamed/project.json': JSON.stringify({
            projectType: 'library',
            targets: { build: {}, publish: {} },
          }),
          '.github/workflows/ci-libraries.yml': createCiLibrariesContent([]),
          '.github/workflows/ci-main.yml': createCiMainContent([]),
        },
      })

      const errors: Array<{ messageId: string; data?: Record<string, string> }> = []
      const ciLibrariesPath = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')

      const handler = rule.create({
        filename: ciLibrariesPath,
        sourceCode: { getText: () => createCiLibrariesContent([]) },
        report: (error: { messageId: string; data?: Record<string, string> }) => {
          errors.push(error)
        },
      } as never)

      if (handler.Program) {
        ;(handler.Program as (node: unknown) => void)({})
      }

      // Should use fallback name lib-unnamed
      expect(errors.some((e) => e.data?.['name'] === 'lib-unnamed')).toBe(true)
    })

    it('returns empty handler when workspace root not found', () => {
      // Create workspace with workflows dir but NO nx.json
      const workspace = manager.create({
        files: {
          '.github/workflows/ci-libraries.yml': 'name: test',
        },
      })

      const handler = rule.create({
        filename: join(workspace.root, '.github', 'workflows', 'ci-libraries.yml'),
        sourceCode: { getText: () => 'name: test' },
      } as never)

      // Should return empty object when no workspace root
      expect(handler).toEqual({})
    })
  })
})
