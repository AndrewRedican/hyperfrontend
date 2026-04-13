import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BackendDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect NestJS in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 * @example Detecting NestJS framework
 * ```typescript
 * // Project with nest-cli.json and NestJS packages
 * const pkg = {
 *   dependencies: {
 *     '@nestjs/core': '^10.2.0',
 *     '@nestjs/common': '^10.2.0',
 *     '@nestjs/platform-express': '^10.2.0',
 *   },
 * }
 *
 * const result = nestDetector('/path/to/nest-project', pkg)
 * // => {
 * //   id: 'nestjs',
 * //   name: 'NestJS',
 * //   version: '10.2.0',
 * //   configPath: 'nest-cli.json',  // if present
 * //   confidence: 100,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.@nestjs/core' },
 * //     { type: 'package.json', field: 'dependencies.@nestjs/common' },
 * //     { type: 'config-file', path: 'nest-cli.json' },
 * //     { type: 'package.json', field: 'dependencies (@nestjs packages)' },
 * //   ],
 * // }
 * ```
 */
export function nestDetector(projectPath: string, packageJson?: PackageJson): BackendDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  let configPath: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@nestjs/core']) {
    confidence += 70
    version = parseVersionString(deps['@nestjs/core'])
    sources.push({ type: 'package.json', field: 'dependencies.@nestjs/core' })
  }

  if (deps['@nestjs/common']) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies.@nestjs/common' })
  }

  if (exists(join(projectPath, 'nest-cli.json'))) {
    confidence += 15
    configPath = 'nest-cli.json'
    sources.push({ type: 'config-file', path: 'nest-cli.json' })
  }

  const nestPackages = keys(deps).filter((d) => d.startsWith('@nestjs/'))
  if (nestPackages.length > 2) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies (@nestjs packages)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'nestjs',
    name: 'NestJS',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
