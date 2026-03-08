import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Solid in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function solidDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['solid-js']) {
    confidence += 70
    version = parseVersionString(deps['solid-js'])
    sources.push({ type: 'package.json', field: 'dependencies.solid-js' })
  }

  if (deps['vite-plugin-solid']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'dependencies.vite-plugin-solid' })
  }

  if (deps['solid-start'] || deps['@solidjs/start']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.solid-start' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'solid',
    name: 'Solid',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
