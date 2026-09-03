import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FlowContext } from '../models/types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import {
  createMockChangelogEntry,
  createMockChangelogItem,
  createMockContext,
  createMockGitClient,
  createMockLogger,
  createMockRegistry,
  createMockTree,
} from './__test-utils__/generate-changelog-mocks'
import { createWriteChangelogStep } from './generate-changelog'

describe('Write Changelog Step', () => {
  describe('createWriteChangelogStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createWriteChangelogStep()

      expect(step.id).toBe('write-changelog')
      expect(step.name).toBe('Write Changelog')
    })

    it('depends on generate-changelog step', () => {
      const step = createWriteChangelogStep()

      expect(step.dependsOn).toContain('generate-changelog')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when no nextVersion', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({ bumpType: 'minor', changelogEntry: createMockChangelogEntry() })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when bumpType is none', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'none',
        changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when no changelog entry', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when changelog disabled', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
        },
        { skipChangelog: true }
      )

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - create new changelog', () => {
    it('creates new CHANGELOG.md when none exists', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '1.0.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Initial feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalled()
      expect(result.message).toContain('Created CHANGELOG.md')
    })

    it('adds changelog path to modified files', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
          modifiedFiles: [],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/CHANGELOG.md')
    })
  })

  describe('execute - update existing changelog', () => {
    it('adds entry to existing CHANGELOG.md', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalled()
      expect(result.message).toContain('Updated CHANGELOG.md')
    })

    it('preserves existing modified files when updating', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
          modifiedFiles: ['/workspace/libs/test/package.json'],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/package.json')
      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/CHANGELOG.md')
    })
  })

  describe('execute - error handling', () => {
    it('handles read error gracefully and creates new changelog', async () => {
      const step = createWriteChangelogStep()
      const logger = createMockLogger()

      const throwingTree = {
        root: '/workspace',
        read: jest.fn((path: string) => {
          if (path.includes('CHANGELOG.md')) {
            throw new Error('Read error')
          }
          return null
        }),
        write: jest.fn(),
        exists: () => false,
        delete: jest.fn(),
        rename: jest.fn(),
        isFile: () => false,
        children: () => [],
        listChanges: () => [],
      } as unknown as Tree

      const ctx: FlowContext = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree: throwingTree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger,
        config: { preset: 'conventional' },
        state: {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
        },
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(logger.debug).toHaveBeenCalledWith('No existing CHANGELOG.md found')
      expect(result.message).toContain('Created CHANGELOG.md')
    })
  })

  describe('execute - custom changelog filename', () => {
    it('uses changelogFileName from config when creating new changelog', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: {} })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '1.0.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({ version: '1.0.0' }),
          },
          { changelogFileName: 'HISTORY.md' }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/HISTORY.md', expect.any(String))
      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/HISTORY.md')
      expect(result.message).toContain('Created HISTORY.md')
    })

    it('uses changelogFileName from config when updating existing changelog', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/RELEASES.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '0.2.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({
              version: '0.2.0',
              sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
            }),
          },
          { changelogFileName: 'RELEASES.md' }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/RELEASES.md', expect.any(String))
      expect(result.message).toContain('Updated RELEASES.md')
    })

    it('defaults to CHANGELOG.md when changelogFileName not specified', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: {} })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0' }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/CHANGELOG.md', expect.any(String))
    })
  })

  describe('execute - backupChangelog feature', () => {
    it('creates backup when backupChangelog enabled and changelog exists', async () => {
      const existingChangelog = `# Changelog

## [1.0.0] - 2025-01-01

### Features

- Existing feature
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog } })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '1.1.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({
              version: '1.1.0',
              sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
            }),
          },
          { backupChangelog: true }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.rename).toHaveBeenCalledWith('/workspace/libs/test/CHANGELOG.md', '/workspace/libs/test/CHANGELOG.backup.md')
    })

    it('deletes backup after successful write', async () => {
      const existingChangelog = `# Changelog

## [1.0.0] - 2025-01-01

### Features

- Existing feature
`
      const step = createWriteChangelogStep()
      const files: Record<string, string> = { '/workspace/libs/test/CHANGELOG.md': existingChangelog }
      const tree = createMockTree({ files })
      const originalExists = tree.exists.bind(tree)
      tree.exists = jest.fn((path: string) => {
        if (path === '/workspace/libs/test/CHANGELOG.backup.md') return true
        return originalExists(path)
      })
      const originalRead = tree.read.bind(tree)
      tree.read = jest.fn((path: string, encoding?: string) => {
        if (path === '/workspace/libs/test/CHANGELOG.backup.md') {
          return encoding ? existingChangelog : Buffer.from(existingChangelog)
        }
        return originalRead(path, encoding as BufferEncoding)
      }) as typeof tree.read
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '1.1.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({
              version: '1.1.0',
              sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
            }),
          },
          { backupChangelog: true }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.delete).toHaveBeenCalledWith('/workspace/libs/test/CHANGELOG.backup.md')
    })

    it('does not create backup when backupChangelog disabled', async () => {
      const existingChangelog = `# Changelog

## [1.0.0] - 2025-01-01

### Features

- Existing feature
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog } })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.1.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '1.1.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.rename).not.toHaveBeenCalled()
    })

    it('does not create backup when no existing changelog', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: {} })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '1.0.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({
              version: '1.0.0',
              sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Initial feature')] }],
            }),
          },
          { backupChangelog: true }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.rename).not.toHaveBeenCalled()
      expect(result.message).toContain('Created')
    })
  })
})
