import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LintingToolDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Biome in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function biomeDetector(projectPath: string, packageJson?: PackageJson): LintingToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let configPath: string | undefined
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  // @biomejs/biome package
  if (deps['@biomejs/biome']) {
    confidence += 70
    version = parseVersionString(deps['@biomejs/biome'])
    sources.push({ type: 'package.json', field: 'dependencies.@biomejs/biome' })
  }

  if (exists(join(projectPath, 'biome.json'))) {
    confidence += 30
    configPath = 'biome.json'
    sources.push({ type: 'config-file', path: 'biome.json' })
  }

  if (!configPath && exists(join(projectPath, 'biome.jsonc'))) {
    confidence += 30
    configPath = 'biome.jsonc'
    sources.push({ type: 'config-file', path: 'biome.jsonc' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'biome',
    name: 'Biome',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
