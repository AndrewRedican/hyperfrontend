import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BackendDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Fastify in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function fastifyDetector(projectPath: string, packageJson?: PackageJson): BackendDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['fastify']) {
    confidence += 80
    version = parseVersionString(deps['fastify'])
    sources.push({ type: 'package.json', field: 'dependencies.fastify' })
  }

  const fastifyPlugins = keys(deps).filter((d) => d.startsWith('@fastify/') || d.startsWith('fastify-'))
  if (fastifyPlugins.length > 0) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies (fastify plugins)' })
  }

  if (deps['@types/fastify']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.@types/fastify' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'fastify',
    name: 'Fastify',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
