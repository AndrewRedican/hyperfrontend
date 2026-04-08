import type { PackageJson } from '../../project/package'
import type { BuildToolDetector, BuildToolDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { babelDetector } from './babel'
import { esbuildDetector } from './esbuild'
import { parcelDetector } from './parcel'
import { rollupDetector } from './rollup'
import { swcDetector } from './swc'
import { viteDetector } from './vite'
import { webpackDetector } from './webpack'

/** All build tool detectors */
export const buildToolDetectors: BuildToolDetector[] = [
  { id: 'webpack', name: 'Webpack', detect: webpackDetector },
  { id: 'vite', name: 'Vite', detect: viteDetector },
  { id: 'rollup', name: 'Rollup', detect: rollupDetector },
  { id: 'esbuild', name: 'esbuild', detect: esbuildDetector },
  { id: 'babel', name: 'Babel', detect: babelDetector },
  { id: 'swc', name: 'SWC', detect: swcDetector },
  { id: 'parcel', name: 'Parcel', detect: parcelDetector },
]

/**
 * Detect all build tools in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected build tools, sorted by confidence
 *
 * @example
 * ```typescript
 * const tools = detectBuildTools('/path/to/project', {
 *   name: 'my-app',
 *   devDependencies: {
 *     'vite': '^5.0.0',
 *     '@vitejs/plugin-react': '^4.0.0',
 *     '@babel/core': '^7.23.0'
 *   }
 * })
 * // => [
 * //   { id: 'vite', name: 'Vite', version: '5.0.0', confidence: 70, ... },
 * //   { id: 'babel', name: 'Babel', version: '7.23.0', confidence: 50, ... }
 * // ]
 * ```
 */
export function detectBuildTools(projectPath: string, packageJson?: PackageJson): BuildToolDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: BuildToolDetection[] = []

  for (const detector of buildToolDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
