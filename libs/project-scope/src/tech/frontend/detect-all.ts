import type { PackageJson } from '../../project/package'
import type { FrameworkDetector, FrameworkDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { angularDetector } from './angular'
import { astroDetector } from './astro'
import { gatsbyDetector } from './gatsby'
import { nextjsDetector } from './nextjs'
import { nuxtDetector } from './nuxt'
import { qwikDetector } from './qwik'
import { reactDetector } from './react'
import { remixDetector } from './remix'
import { solidDetector } from './solid'
import { svelteDetector } from './svelte'
import { sveltekitDetector } from './sveltekit'
import { vueDetector } from './vue'

/** All frontend framework detectors */
export const frameworkDetectors: FrameworkDetector[] = [
  { id: 'react', name: 'React', category: 'frontend', detect: reactDetector },
  { id: 'nextjs', name: 'Next.js', category: 'meta-framework', detect: nextjsDetector },
  { id: 'remix', name: 'Remix', category: 'meta-framework', detect: remixDetector },
  { id: 'gatsby', name: 'Gatsby', category: 'meta-framework', detect: gatsbyDetector },
  { id: 'vue', name: 'Vue', category: 'frontend', detect: vueDetector },
  { id: 'nuxt', name: 'Nuxt', category: 'meta-framework', detect: nuxtDetector },
  { id: 'angular', name: 'Angular', category: 'frontend', detect: angularDetector },
  { id: 'svelte', name: 'Svelte', category: 'frontend', detect: svelteDetector },
  { id: 'sveltekit', name: 'SvelteKit', category: 'meta-framework', detect: sveltekitDetector },
  { id: 'solid', name: 'Solid', category: 'frontend', detect: solidDetector },
  { id: 'qwik', name: 'Qwik', category: 'frontend', detect: qwikDetector },
  { id: 'astro', name: 'Astro', category: 'meta-framework', detect: astroDetector },
]

/**
 * Detect all frontend frameworks in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected frameworks, sorted by confidence
 *
 * @example
 * ```typescript
 * const frameworks = detectFrontendFrameworks('/path/to/nextjs-app', {
 *   dependencies: { 'react': '^18.0.0', 'next': '^14.0.0' }
 * })
 * // => [
 * //   { id: 'nextjs', name: 'Next.js', category: 'meta-framework', confidence: 70, ... },
 * //   { id: 'react', name: 'React', category: 'frontend', confidence: 60, ... }
 * // ]
 * ```
 */
export function detectFrontendFrameworks(projectPath: string, packageJson?: PackageJson): FrameworkDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: FrameworkDetection[] = []

  for (const detector of frameworkDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
