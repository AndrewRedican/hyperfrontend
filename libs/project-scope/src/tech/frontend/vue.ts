import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Vue in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function vueDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  const metaFrameworks: FrameworkDetection[] = []

  const deps = collectAllDependencies(pkg)

  if (deps['vue']) {
    confidence += 70
    version = parseVersionString(deps['vue'])
    sources.push({ type: 'package.json', field: 'dependencies.vue' })
  }

  if (deps['@vue/cli-service']) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies.@vue/cli-service' })
  }

  const hasVueFiles = exists(join(projectPath, 'src', 'App.vue')) || exists(join(projectPath, 'src', 'main.vue'))
  if (hasVueFiles) {
    confidence += 10
    sources.push({ type: 'directory', path: 'src/*.vue' })
  }

  if (exists(join(projectPath, 'vue.config.js'))) {
    confidence += 5
    sources.push({ type: 'config-file', path: 'vue.config.js' })
  }

  if (deps['nuxt'] || deps['nuxt3']) {
    metaFrameworks.push({
      id: 'nuxt',
      name: 'Nuxt',
      category: 'meta-framework',
      version: parseVersionString(deps['nuxt'] ?? deps['nuxt3']),
      confidence: 90,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.nuxt' }],
    })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'vue',
    name: 'Vue',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
    metaFrameworks: metaFrameworks.length > 0 ? metaFrameworks : undefined,
  }
}
