import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect React in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function reactDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  const metaFrameworks: FrameworkDetection[] = []

  const deps = collectAllDependencies(pkg)

  if (deps['react']) {
    confidence += 60
    version = parseVersionString(deps['react'])
    sources.push({ type: 'package.json', field: 'dependencies.react' })
  }

  if (deps['react-dom']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'dependencies.react-dom' })
  }

  if (deps['react-native']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'dependencies.react-native' })
  }

  const hasJsxFiles =
    exists(join(projectPath, 'src', 'App.tsx')) ||
    exists(join(projectPath, 'src', 'App.jsx')) ||
    exists(join(projectPath, 'src', 'index.tsx')) ||
    exists(join(projectPath, 'src', 'index.jsx'))
  if (hasJsxFiles) {
    confidence += 10
    sources.push({ type: 'directory', path: 'src/*.tsx or src/*.jsx' })
  }

  if (deps['next']) {
    metaFrameworks.push({
      id: 'nextjs',
      name: 'Next.js',
      category: 'meta-framework',
      version: parseVersionString(deps['next']),
      confidence: 90,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.next' }],
    })
  }

  if (deps['gatsby']) {
    metaFrameworks.push({
      id: 'gatsby',
      name: 'Gatsby',
      category: 'meta-framework',
      version: parseVersionString(deps['gatsby']),
      confidence: 90,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.gatsby' }],
    })
  }

  if (deps['@remix-run/react'] || deps['remix']) {
    metaFrameworks.push({
      id: 'remix',
      name: 'Remix',
      category: 'meta-framework',
      version: parseVersionString(deps['@remix-run/react'] ?? deps['remix']),
      confidence: 90,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.@remix-run/react' }],
    })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'react',
    name: 'React',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
    metaFrameworks: metaFrameworks.length > 0 ? metaFrameworks : undefined,
  }
}
