import type { Mock } from '@hyperfrontend/testing'
import type { FlowContext, FlowState } from '../models/types'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createMockChangelogEntry,
  createMockChangelogItem,
  createMockContext,
  createMockTree,
} from './__test-utils__/generate-changelog-mocks'
import { createWriteChangelogStep } from './generate-changelog'

async function writeOver(existingChangelog: string, state: Partial<FlowState>) {
  const step = createWriteChangelogStep()
  const tree = createMockTree({
    files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
  })
  const ctx: FlowContext = {
    ...createMockContext(state),
    tree,
  }

  const result = await step.execute(ctx)

  // why: indexing the first call throws when nothing was written, so a not.toContain check can never pass on a missing write.
  const writtenContent = (tree.write as Mock).mock.calls[0][1] as string
  return { result, writtenContent, logger: ctx.logger }
}

describe('Write Changelog Step', () => {
  describe('execute - pending publication cleanup', () => {
    describe('with one stacked entry while pending publication', () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Unpublished feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the new entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Updated feature')
      })

      it('removes the stacked entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Unpublished feature')
      })

      it('keeps the published entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.1.0')
      })
    })

    describe('with several stacked entries while pending publication', () => {
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
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Correct feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the new entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Correct feature')
      })

      it('removes the stacked 0.3.0 entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Feature 0.3.0')
      })

      it('removes the stacked 0.2.0 entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Feature 0.2.0')
      })

      it('keeps the published entry', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.1.0')
      })

      it('logs the removal of the stacked entries', async () => {
        const { logger } = await run()

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Removing stacked entries'))
      })
    })

    describe('with an unreleased entry above a stacked entry while pending publication', () => {
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
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('preserves the unreleased heading during cleanup', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Unreleased')
      })

      it('preserves the unreleased items during cleanup', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Work in progress')
      })
    })

    describe('when isPendingPublication is false', () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: false,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the new version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.2.0')
      })

      it('does not remove the existing version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.1.0')
      })

      it('writes the new entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('New feature')
      })

      it('does not remove the existing entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Initial release')
      })
    })

    describe('when isPendingPublication is undefined', () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the new version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.2.0')
      })

      it('does not remove the existing version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.1.0')
      })
    })

    describe('de-escalation scenario (version downgrade)', () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Wrong version feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.1.1',
          bumpType: 'patch',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.1.1',
            sections: [{ type: 'fixes' as const, heading: 'Bug Fixes', items: [createMockChangelogItem('Bug fix')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the downgraded version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.1.1')
      })

      it('removes the stacked higher version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('0.2.0')
      })

      it('writes the new entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('Bug fix')
      })

      it('removes the stacked entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Wrong version feature')
      })
    })

    describe('escalation scenario (version upgrade)', () => {
      const existingChangelog = `# Changelog

## [0.1.1] - 2024-01-10

### Bug Fixes

- Wrong version fix

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the upgraded version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('0.2.0')
      })

      it('removes the stacked lower version', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('0.1.1')
      })

      it('writes the new entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('New feature')
      })

      it('removes the stacked entry items', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Wrong version fix')
      })
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

    describe('replacing an existing entry of the same version (replaceExisting) in pending publication state', () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Old content

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const run = () =>
        writeOver(existingChangelog, {
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New content')] }],
          }),
        })

      it('reports success', async () => {
        const { result } = await run()

        expect(result.status).toBe('success')
      })

      it('writes the new content', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).toContain('New content')
      })

      it('removes the old content', async () => {
        const { writtenContent } = await run()

        expect(writtenContent).not.toContain('Old content')
      })

      it('writes a single heading for the replaced version', async () => {
        const { writtenContent } = await run()

        const matches = writtenContent.match(/##\s+\[?0\.2\.0\]?/g)
        expect(matches).toHaveLength(1)
      })
    })
  })
})
