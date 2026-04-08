import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BackendDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Koa in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 * @example
 * ```typescript
 * const pkg = {
 *   dependencies: { koa: '^2.14.2', 'koa-router': '^12.0.0' },
 *   devDependencies: { '@types/koa': '^2.13.9' },
 * }
 *
 * const result = koaDetector('/path/to/project', pkg)
 * // => {
 * //   id: 'koa',
 * //   name: 'Koa',
 * //   version: '2.14.2',
 * //   confidence: 100,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.koa' },
 * //     { type: 'package.json', field: 'dependencies.@types/koa' },
 * //     { type: 'package.json', field: 'dependencies (koa middleware)' },
 * //   ],
 * // }
 * ```
 */
export function koaDetector(projectPath: string, packageJson?: PackageJson): BackendDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['koa']) {
    confidence += 80
    version = parseVersionString(deps['koa'])
    sources.push({ type: 'package.json', field: 'dependencies.koa' })
  }

  if (deps['@types/koa']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.@types/koa' })
  }

  const koaMiddleware = keys(deps).filter((d) => d.startsWith('koa-') || d.startsWith('@koa/'))
  if (koaMiddleware.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (koa middleware)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'koa',
    name: 'Koa',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
