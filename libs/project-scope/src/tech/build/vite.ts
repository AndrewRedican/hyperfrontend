import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Vite */
export const VITE_CONFIG_PATTERNS = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs']

/**
 * Detect Vite in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function viteDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['vite']) {
    confidence += 60
    version = parseVersionString(deps['vite'])
    sources.push({ type: 'package.json', field: 'dependencies.vite' })
  }

  const configPath = locateConfigFile(projectPath, VITE_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 35
    sources.push({ type: 'config-file', path: configPath })
  }

  if (deps['vitest']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.vitest' })
  }

  const vitePlugins = keys(deps).filter((d) => d.startsWith('vite-plugin-') || d.startsWith('@vitejs/'))
  if (vitePlugins.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (vite plugins)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'vite',
    name: 'Vite',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
