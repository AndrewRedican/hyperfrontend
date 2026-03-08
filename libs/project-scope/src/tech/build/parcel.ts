import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile, filterScriptsByCommand } from '../shared-utils/detector-helpers'

/** Config patterns for Parcel */
export const PARCEL_CONFIG_PATTERNS = ['.parcelrc']

/**
 * Detect Parcel in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function parcelDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['parcel']) {
    confidence += 60
    version = parseVersionString(deps['parcel'])
    sources.push({ type: 'package.json', field: 'dependencies.parcel' })
  }

  if (deps['parcel-bundler']) {
    confidence += 60
    version = parseVersionString(deps['parcel-bundler'])
    sources.push({ type: 'package.json', field: 'dependencies.parcel-bundler' })
  }

  const configPath = locateConfigFile(projectPath, PARCEL_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 30
    sources.push({ type: 'config-file', path: configPath })
  }

  const scriptMatches = filterScriptsByCommand(pkg?.scripts, 'parcel')
  for (const name of scriptMatches) {
    confidence = min(confidence + 10, 100)
    sources.push({ type: 'package.json', field: `scripts.${name}` })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'parcel',
    name: 'Parcel',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
