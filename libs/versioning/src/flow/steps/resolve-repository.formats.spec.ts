import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig } from '../../repository/models/repository-config'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it } from '@hyperfrontend/testing'
import { createResolveRepositoryStep } from './resolve-repository'

/**
 * Builds a git client whose `origin` remote resolves to the given URL; nothing else on it is used by the step.
 *
 * @param remoteUrl - Remote URL the client reports, null when the repository has no remote
 * @returns Git client answering `getRemoteUrl` with the remote URL
 */
function createMockGitClient(remoteUrl: string | null = null): GitClient {
  return createMock<GitClient>({ getRemoteUrl: () => remoteUrl })
}

function createMockContext(overrides?: {
  tree?: Tree
  registry?: Registry
  git?: GitClient
  logger?: Logger
  state?: FlowState
  config?: Partial<FlowConfig>
}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: overrides?.tree ?? createMemoryTree(),
    registry: overrides?.registry ?? createMock<Registry>(),
    git: overrides?.git ?? createMockGitClient(),
    logger: overrides?.logger ?? createMock<Logger>(),
    config: { preset: 'conventional', ...overrides?.config },
    state: overrides?.state ?? {},
  }
}

function resolvedTo(repositoryConfig: Partial<RepositoryConfig>) {
  return expect.objectContaining({
    status: 'success',
    stateUpdates: expect.objectContaining({ repositoryConfig: expect.objectContaining(repositoryConfig) }),
  })
}

describe('resolve-repository step', () => {
  describe('createResolveRepositoryStep', () => {
    describe('platform detection', () => {
      it('detects GitHub', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://github.com/owner/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('github')
      })

      it('detects GitLab', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://gitlab.com/group/project',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('gitlab')
      })

      it('detects Bitbucket', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://bitbucket.org/team/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result.stateUpdates?.repositoryConfig?.platform).toBe('bitbucket')
      })
    })

    describe('shorthand formats', () => {
      it('handles github shorthand', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'github:owner/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })

      it('handles object format with url', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: {
              type: 'git',
              url: 'https://github.com/owner/repo.git',
            },
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('git remote formats', () => {
      it('handles HTTPS remote', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient('https://github.com/owner/repo.git')

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/owner/repo' }))
      })

      it('handles SSH remote', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient('git@github.com:owner/repo.git')

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('additional platform detection', () => {
      it('detects Azure DevOps', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://dev.azure.com/org/project/_git/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'azure-devops' }))
      })

      it('detects Azure DevOps visualstudio.com format', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'https://org.visualstudio.com/project/_git/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'azure-devops' }))
      })
    })

    describe('additional shorthand formats', () => {
      it('handles gitlab shorthand', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'gitlab:group/project',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' }))
      })

      it('handles bitbucket shorthand', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: 'bitbucket:team/repo',
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'bitbucket', baseUrl: 'https://bitbucket.org/team/repo' }))
      })

      it('handles git+https URL format', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({
            repository: {
              type: 'git',
              url: 'git+https://github.com/owner/repo.git',
            },
          }),
        })

        const ctx = createMockContext({
          tree,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'github', baseUrl: 'https://github.com/owner/repo' }))
      })
    })

    describe('additional git remote formats', () => {
      it('handles SSH remote for GitLab', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient('git@gitlab.com:group/project.git')

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' }))
      })

      it('handles SSH remote for Bitbucket', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient('git@bitbucket.org:team/repo.git')

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ platform: 'bitbucket', baseUrl: 'https://bitbucket.org/team/repo' }))
      })

      it('handles HTTPS remote without .git extension', async () => {
        const tree = createMemoryTree({
          '/workspace/libs/test/package.json': JSON.stringify({ name: '@test/pkg' }),
        })

        const git = createMockGitClient('https://github.com/owner/repo')

        const ctx = createMockContext({
          tree,
          git,
          config: { repository: 'inferred' },
        })

        const step = createResolveRepositoryStep()
        const result = await step.execute(ctx)

        expect(result).toEqual(resolvedTo({ baseUrl: 'https://github.com/owner/repo' }))
      })
    })
  })
})
