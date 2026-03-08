import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, filterScriptsByCommand } from '../shared-utils/detector-helpers'

/**
 * Detect esbuild in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function esbuildDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['esbuild']) {
    confidence += 70
    version = parseVersionString(deps['esbuild'])
    sources.push({ type: 'package.json', field: 'dependencies.esbuild' })
  }

  const esbuildPlugins = keys(deps).filter((d) => d.includes('esbuild-plugin') || d.includes('esbuild-'))
  if (esbuildPlugins.length > 0) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies (esbuild plugins)' })
  }

  const scriptMatches = filterScriptsByCommand(pkg?.scripts, 'esbuild')
  for (const name of scriptMatches) {
    confidence = min(confidence + 10, 100)
    sources.push({ type: 'package.json', field: `scripts.${name}` })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'esbuild',
    name: 'esbuild',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
