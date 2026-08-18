import type { FlowContext } from '../models/types'
import {
  createMockChangelogEntry,
  createMockChangelogItem,
  createMockContext,
  createMockLogger,
  createMockTree,
} from './__test-utils__/generate-changelog-mocks'
import { createWriteChangelogStep } from './generate-changelog'

describe('Write Changelog Step', () => {
  describe('execute - pending publication cleanup', () => {
    it('removes stacked entries when isPendingPublication is true', async () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Unpublished feature

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
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('Updated feature')
      expect(writtenContent).not.toContain('Unpublished feature')
      expect(writtenContent).toContain('0.1.0')
    })

    it('removes multiple stacked entries when isPendingPublication is true', async () => {
      const existingChangelog = `# Changelog

## [0.3.0] - 2024-01-15

### Features

- Feature 0.3.0

## [0.2.0] - 2024-01-10

### Features

- Feature 0.2.0

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const logger = createMockLogger()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Correct feature')] }],
          }),
        }),
        tree,
        logger,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('Correct feature')
      expect(writtenContent).not.toContain('Feature 0.3.0')
      expect(writtenContent).not.toContain('Feature 0.2.0')
      expect(writtenContent).toContain('0.1.0')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Removing stacked entries'))
    })

    it('preserves unreleased entry during cleanup', async () => {
      const existingChangelog = `# Changelog

## [Unreleased]

### Features

- Work in progress

## [0.2.0] - 2024-01-10

### Features

- Unpublished feature

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
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('Unreleased')
      expect(writtenContent).toContain('Work in progress')
    })

    it('does not remove entries when isPendingPublication is false', async () => {
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
          publishedVersion: '0.1.0',
          isPendingPublication: false,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).toContain('0.1.0')
      expect(writtenContent).toContain('New feature')
      expect(writtenContent).toContain('Initial release')
    })

    it('does not remove entries when isPendingPublication is undefined', async () => {
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
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).toContain('0.1.0')
    })

    it('handles de-escalation scenario (version downgrade)', async () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Wrong version feature

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
          nextVersion: '0.1.1',
          bumpType: 'patch',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.1.1',
            sections: [{ type: 'fixes' as const, heading: 'Bug Fixes', items: [createMockChangelogItem('Bug fix')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('0.1.1')
      expect(writtenContent).not.toContain('0.2.0')
      expect(writtenContent).toContain('Bug fix')
      expect(writtenContent).not.toContain('Wrong version feature')
    })

    it('handles escalation scenario (version upgrade)', async () => {
      const existingChangelog = `# Changelog

## [0.1.1] - 2024-01-10

### Bug Fixes

- Wrong version fix

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
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).not.toContain('0.1.1')
      expect(writtenContent).toContain('New feature')
      expect(writtenContent).not.toContain('Wrong version fix')
    })

    it('does not fail when publishedVersion is missing during pending state', async () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Some feature

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
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
    })

    it('uses replaceExisting when adding entry in pending publication state', async () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Old content

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
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New content')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('New content')
      expect(writtenContent).not.toContain('Old content')
      const matches = writtenContent.match(/##\s+\[?0\.2\.0\]?/g)
      expect(matches).toHaveLength(1)
    })
  })
})
