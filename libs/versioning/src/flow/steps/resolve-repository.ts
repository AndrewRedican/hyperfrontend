import type { RepositoryConfig } from '../../repository/models/repository-config'
import type { RepositoryInferenceSource, RepositoryResolution } from '../../repository/models/resolution'
import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isRepositoryConfig } from '../../repository/models/repository-config'
import { isRepositoryResolution, DEFAULT_INFERENCE_ORDER } from '../../repository/models/resolution'
import { inferRepositoryFromPackageJson } from '../../repository/parse/package-json'
import { createRepositoryConfigFromUrl } from '../../repository/parse/url'
import { createStep } from '../models/step'

export const RESOLVE_REPOSITORY_STEP_ID = 'resolve-repository'

/**
 * Creates the resolve-repository step.
 *
 * This step resolves repository configuration for compare URL generation.
 * It supports multiple resolution modes:
 *
 * - `undefined` or `'disabled'`: No-op, backward compatible default
 * - `'inferred'`: Auto-detect from package.json or git remote
 * - `RepositoryConfig`: Direct repository configuration provided
 * - `RepositoryResolution`: Fine-grained control with mode and options
 *
 * State updates:
 * - repositoryConfig: Resolved repository configuration (if successful)
 *
 * @returns A FlowStep that resolves repository configuration
 *
 * @example
 * ```typescript
 * // Auto-detect repository
 * const flow = createFlow({
 *   repository: 'inferred'
 * })
 *
 * // Explicit repository
 * const flow = createFlow({
 *   repository: {
 *     platform: 'github',
 *     baseUrl: 'https://github.com/owner/repo'
 *   }
 * })
 * ```
 */
export function createResolveRepositoryStep(): FlowStep {
  return createStep(
    RESOLVE_REPOSITORY_STEP_ID,
    'Resolve Repository',
    async (ctx) => {
      const { config, logger, tree, git, projectRoot } = ctx
      const repoConfig = config.repository

      // Disabled or undefined - no-op for backward compatibility
      if (repoConfig === undefined || repoConfig === 'disabled') {
        logger.debug('Repository resolution disabled')
        return {
          status: 'skipped',
          message: 'Repository resolution disabled',
        }
      }

      // Direct RepositoryConfig provided
      if (isRepositoryConfig(repoConfig)) {
        logger.debug(`Using explicit repository config: ${repoConfig.platform}`)
        return {
          status: 'success',
          stateUpdates: {
            repositoryConfig: repoConfig,
          },
          message: `Using explicit ${repoConfig.platform} repository`,
        }
      }

      // Shorthand 'inferred' mode
      if (repoConfig === 'inferred') {
        const resolved = await inferRepository(tree, git, projectRoot, DEFAULT_INFERENCE_ORDER, logger)
        if (resolved) {
          return {
            status: 'success',
            stateUpdates: {
              repositoryConfig: resolved,
            },
            message: `Inferred ${resolved.platform} repository from ${resolved.baseUrl}`,
          }
        }

        // Graceful degradation - no error, just no URLs
        logger.debug('Could not infer repository from package.json or git remote')
        return {
          status: 'skipped',
          message: 'Could not infer repository configuration',
        }
      }

      // Full RepositoryResolution object
      if (isRepositoryResolution(repoConfig)) {
        return handleRepositoryResolution(repoConfig, tree, git, projectRoot, logger)
      }

      // Unknown configuration - should not happen with TypeScript
      logger.warn('Unknown repository configuration format')
      return {
        status: 'skipped',
        message: 'Unknown repository configuration format',
      }
    },
    {
      description: 'Resolves repository configuration for compare URL generation',
    }
  )
}

/**
 * Handles a full RepositoryResolution configuration.
 *
 * @param resolution - Repository resolution configuration
 * @param tree - Virtual file system tree
 * @param git - Git client instance
 * @param projectRoot - Path to the project root
 * @param logger - Logger instance
 * @returns Flow step result with repository config or skip/error status
 * @internal
 */
async function handleRepositoryResolution(
  resolution: RepositoryResolution,
  tree: import('@hyperfrontend/project-scope').Tree,
  git: import('../../git/factory').GitClient,
  projectRoot: string,
  logger: import('@hyperfrontend/logging').Logger
): Promise<import('../models/types').FlowStepResult> {
  const { mode, repository, inferenceOrder } = resolution

  // Disabled mode
  if (mode === 'disabled') {
    logger.debug('Repository resolution explicitly disabled')
    return {
      status: 'skipped',
      message: 'Repository resolution disabled',
    }
  }

  // Explicit mode - must have repository
  if (mode === 'explicit') {
    if (!repository) {
      return {
        status: 'failed',
        message: 'Repository config required when mode is "explicit"',
        error: createError('Repository config required when mode is "explicit"'),
      }
    }

    logger.debug(`Using explicit repository config: ${repository.platform}`)
    return {
      status: 'success',
      stateUpdates: {
        repositoryConfig: repository,
      },
      message: `Using explicit ${repository.platform} repository`,
    }
  }

  // Inferred mode
  const order = inferenceOrder ?? DEFAULT_INFERENCE_ORDER
  const resolved = await inferRepository(tree, git, projectRoot, order, logger)

  if (resolved) {
    return {
      status: 'success',
      stateUpdates: {
        repositoryConfig: resolved,
      },
      message: `Inferred ${resolved.platform} repository`,
    }
  }

  // Graceful degradation
  logger.debug('Could not infer repository configuration')
  return {
    status: 'skipped',
    message: 'Could not infer repository configuration',
  }
}

/**
 * Infers repository configuration from available sources.
 *
 * @param tree - Virtual file system tree
 * @param git - Git client instance
 * @param projectRoot - Path to the project root
 * @param order - Inference source order
 * @param logger - Logger instance
 * @returns Repository config or null if none found
 * @internal
 */
async function inferRepository(
  tree: import('@hyperfrontend/project-scope').Tree,
  git: import('../../git/factory').GitClient,
  projectRoot: string,
  order: readonly RepositoryInferenceSource[],
  logger: import('@hyperfrontend/logging').Logger
): Promise<RepositoryConfig | null> {
  for (const source of order) {
    const config = await inferFromSource(tree, git, projectRoot, source, logger)
    if (config) {
      logger.debug(`Inferred repository from ${source}: ${config.platform}`)
      return config
    }
  }

  return null
}

/**
 * Infers repository from a single source.
 *
 * @param tree - Virtual file system tree
 * @param git - Git client instance
 * @param projectRoot - Path to the project root
 * @param source - Inference source type
 * @param logger - Logger instance
 * @returns Repository config or null if not found
 * @internal
 */
async function inferFromSource(
  tree: import('@hyperfrontend/project-scope').Tree,
  git: import('../../git/factory').GitClient,
  projectRoot: string,
  source: RepositoryInferenceSource,
  logger: import('@hyperfrontend/logging').Logger
): Promise<RepositoryConfig | null> {
  if (source === 'package-json') {
    return inferFromPackageJson(tree, projectRoot, logger)
  }

  if (source === 'git-remote') {
    return inferFromGitRemote(git, logger)
  }

  logger.warn(`Unknown inference source: ${source}`)
  return null
}

/**
 * Infers repository from package.json repository field.
 *
 * @param tree - Virtual file system tree
 * @param projectRoot - Path to the project root
 * @param logger - Logger instance
 * @returns Repository config or null if not found
 * @internal
 */
function inferFromPackageJson(
  tree: import('@hyperfrontend/project-scope').Tree,
  projectRoot: string,
  logger: import('@hyperfrontend/logging').Logger
): RepositoryConfig | null {
  const packageJsonPath = `${projectRoot}/package.json`

  if (!tree.isFile(packageJsonPath)) {
    logger.debug(`package.json not found or not a file at ${packageJsonPath}`)
    return null
  }

  const content = tree.read(packageJsonPath, 'utf-8')
  if (!content) {
    logger.debug('Could not read package.json')
    return null
  }

  const config = inferRepositoryFromPackageJson(content)
  if (config) {
    logger.debug(`Found repository in package.json: ${config.baseUrl}`)
  }

  return config
}

/**
 * Infers repository from git remote URL.
 *
 * @param git - Git client instance
 * @param logger - Logger instance
 * @returns Repository config or null if not found
 * @internal
 */
async function inferFromGitRemote(
  git: import('../../git/factory').GitClient,
  logger: import('@hyperfrontend/logging').Logger
): Promise<RepositoryConfig | null> {
  const remoteUrl = await git.getRemoteUrl('origin')

  if (!remoteUrl) {
    logger.debug('Could not get git remote URL')
    return null
  }

  const config = createRepositoryConfigFromUrl(remoteUrl)
  if (config) {
    logger.debug(`Inferred repository from git remote: ${config.baseUrl}`)
  }

  return config
}
