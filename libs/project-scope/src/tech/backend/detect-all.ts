import type { PackageJson } from '../../project/package'
import type { BackendDetector, BackendDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { expressDetector } from './express'
import { fastifyDetector } from './fastify'
import { honoDetector } from './hono'
import { koaDetector } from './koa'
import { nestDetector } from './nestjs'

/** All backend framework detectors */
export const backendDetectors: BackendDetector[] = [
  { id: 'express', name: 'Express', detect: expressDetector },
  { id: 'nestjs', name: 'NestJS', detect: nestDetector },
  { id: 'fastify', name: 'Fastify', detect: fastifyDetector },
  { id: 'koa', name: 'Koa', detect: koaDetector },
  { id: 'hono', name: 'Hono', detect: honoDetector },
]

/**
 * Detect all backend frameworks in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected frameworks, sorted by confidence
 * @example
 * ```typescript
 * const pkg = {
 *   dependencies: { '@nestjs/core': '^10.0.0', '@nestjs/common': '^10.0.0' },
 *   devDependencies: { express: '^4.18.0' },
 * }
 *
 * const results = detectBackendFrameworks('/path/to/project', pkg)
 * // => [
 * //   { id: 'nestjs', name: 'NestJS', confidence: 85, ... },
 * //   { id: 'express', name: 'Express', confidence: 80, ... },
 * // ]
 * ```
 */
export function detectBackendFrameworks(projectPath: string, packageJson?: PackageJson): BackendDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: BackendDetection[] = []

  for (const detector of backendDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
