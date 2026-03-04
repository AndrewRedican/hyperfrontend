import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BackendDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Express in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function expressDetector(projectPath: string, packageJson?: PackageJson): BackendDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['express']) {
    confidence += 80
    version = parseVersionString(deps['express'])
    sources.push({ type: 'package.json', field: 'dependencies.express' })
  }

  // @types/express (indicates usage)
  if (deps['@types/express']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.@types/express' })
  }

  const expressMiddleware = keys(deps).filter(
    (d) => d.includes('express-') || d === 'body-parser' || d === 'cors' || d === 'helmet' || d === 'morgan'
  )
  if (expressMiddleware.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (express middleware)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'express',
    name: 'Express',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
