import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, readDirectory, readFileIfExists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Type system detection result.
 */
export interface TypeSystemDetection {
  /** Type system identifier */
  id: 'typescript' | 'flow' | 'jsdoc'
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Config file path */
  configPath?: string
  /** Strict mode enabled */
  strictMode?: boolean
  /** Detection confidence (0-100) */
  confidence: number
  /** Detection sources */
  detectedFrom: DetectionSource[]
}

/**
 * Type system detector interface.
 */
export interface TypeSystemDetector {
  /** Type system identifier */
  id: 'typescript' | 'flow' | 'jsdoc'
  /** Human-readable name */
  name: string
  /** Check if type system is present */
  detect(projectPath: string, packageJson?: PackageJson): TypeSystemDetection | null
}

/**
 * Check if tsconfig has strict mode enabled.
 *
 * @param projectPath - The project directory path
 * @returns True if strict mode is enabled, undefined if unable to determine
 */
function checkTsConfigStrict(projectPath: string): boolean | undefined {
  const tsconfigPath = join(projectPath, 'tsconfig.json')
  const content = readFileIfExists(tsconfigPath)
  if (!content) return undefined

  try {
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    const parsed = parse(cleanContent)
    return parsed?.compilerOptions?.strict === true
  } catch {
    return undefined
  }
}

/**
 * Detect TypeScript in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function typescriptDetector(projectPath: string, packageJson?: PackageJson): TypeSystemDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let configPath: string | undefined
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['typescript']) {
    confidence += 50
    version = parseVersionString(deps['typescript'])
    sources.push({ type: 'package.json', field: 'dependencies.typescript' })
  }

  if (exists(join(projectPath, 'tsconfig.json'))) {
    confidence += 40
    configPath = 'tsconfig.json'
    sources.push({ type: 'config-file', path: 'tsconfig.json' })
  }

  const tsconfigVariants = ['tsconfig.build.json', 'tsconfig.lib.json', 'tsconfig.spec.json', 'tsconfig.app.json']
  for (const variant of tsconfigVariants) {
    if (exists(join(projectPath, variant))) {
      confidence += 5
      sources.push({ type: 'config-file', path: variant })
      break
    }
  }

  const typePackages = keys(deps).filter((d) => d.startsWith('@types/'))
  if (typePackages.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: '@types/* packages' })
  }

  if (confidence === 0) {
    return null
  }

  const strictMode = checkTsConfigStrict(projectPath)

  return {
    id: 'typescript',
    name: 'TypeScript',
    version,
    configPath,
    strictMode,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}

/**
 * Detect Flow in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function flowDetector(projectPath: string, packageJson?: PackageJson): TypeSystemDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let configPath: string | undefined
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['flow-bin']) {
    confidence += 60
    version = parseVersionString(deps['flow-bin'])
    sources.push({ type: 'package.json', field: 'dependencies.flow-bin' })
  }

  if (exists(join(projectPath, '.flowconfig'))) {
    confidence += 40
    configPath = '.flowconfig'
    sources.push({ type: 'config-file', path: '.flowconfig' })
  }

  if (exists(join(projectPath, 'flow-typed'))) {
    confidence += 10
    sources.push({ type: 'directory', path: 'flow-typed/' })
  }

  if (deps['@babel/preset-flow']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.@babel/preset-flow' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'flow',
    name: 'Flow',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}

/**
 * Check if a file contains JSDoc type annotations.
 *
 * @param content - The file content to check.
 * @returns `true` if the content contains JSDoc type annotations.
 */
function hasJsDocTypes(content: string): boolean {
  return (
    content.includes('@type {') ||
    content.includes('@param {') ||
    content.includes('@returns {') ||
    content.includes('@typedef') ||
    content.includes('@template')
  )
}

/**
 * Detect JSDoc type annotations in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function jsdocDetector(projectPath: string, packageJson?: PackageJson): TypeSystemDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0

  const deps = collectAllDependencies(pkg)

  if (deps['jsdoc']) {
    confidence += 30
    sources.push({ type: 'package.json', field: 'dependencies.jsdoc' })
  }

  if (deps['typescript']) {
    const tsconfigPath = join(projectPath, 'tsconfig.json')
    const content = readFileIfExists(tsconfigPath)
    if (content) {
      try {
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
        const parsed = parse(cleanContent)
        if (parsed?.compilerOptions?.checkJs === true || parsed?.compilerOptions?.allowJs === true) {
          confidence += 30
          sources.push({ type: 'config-file', path: 'tsconfig.json (checkJs/allowJs)' })
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  if (exists(join(projectPath, 'jsconfig.json'))) {
    confidence += 40
    sources.push({ type: 'config-file', path: 'jsconfig.json' })
  }

  const srcDir = join(projectPath, 'src')
  if (exists(srcDir)) {
    try {
      const entries = readDirectory(srcDir)
      const files = entries.filter((e) => e.isFile && (e.name.endsWith('.js') || e.name.endsWith('.mjs'))).map((e) => e.name)
      for (const file of files.slice(0, 3)) {
        const content = readFileIfExists(join(srcDir, file))
        if (content && hasJsDocTypes(content)) {
          confidence += 20
          sources.push({ type: 'directory', path: `src/${file} (JSDoc annotations)` })
          break
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'jsdoc',
    name: 'JSDoc',
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}

/** All type system detectors */
export const typeSystemDetectors: TypeSystemDetector[] = [
  { id: 'typescript', name: 'TypeScript', detect: typescriptDetector },
  { id: 'flow', name: 'Flow', detect: flowDetector },
  { id: 'jsdoc', name: 'JSDoc', detect: jsdocDetector },
]

/**
 * Detect all type systems in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected type systems, sorted by confidence
 */
export function detectTypeSystems(projectPath: string, packageJson?: PackageJson): TypeSystemDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: TypeSystemDetection[] = []

  for (const detector of typeSystemDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
