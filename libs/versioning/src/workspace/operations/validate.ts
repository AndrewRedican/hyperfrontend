import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { satisfies } from '../../semver/compare/compare'
import { parseRange } from '../../semver/parse/range'
import { parseVersion } from '../../semver/parse/version'

/**
 * Validation result for a single check.
 */
export interface ValidationResult {
  /** Whether the check passed */
  readonly valid: boolean

  /** Error message if invalid */
  readonly error?: string

  /** Warning message (valid but potentially problematic) */
  readonly warning?: string
}

/**
 * Aggregated validation report.
 */
export interface ValidationReport {
  /** All validation results */
  readonly results: readonly ValidationCheckResult[]

  /** Whether all checks passed */
  readonly valid: boolean

  /** Total number of errors */
  readonly errorCount: number

  /** Total number of warnings */
  readonly warningCount: number

  /** Packages with validation errors */
  readonly invalidPackages: readonly string[]
}

/**
 * Result of a specific validation check.
 */
export interface ValidationCheckResult {
  /** Check identifier */
  readonly checkId: string

  /** Human-readable check name */
  readonly checkName: string

  /** Package being checked (null for workspace-level checks) */
  readonly packageName: string | null

  /** Check result */
  readonly result: ValidationResult
}

/**
 * Validates a workspace for common issues.
 *
 * @param workspace - The workspace to validate
 * @returns Validation report
 *
 * @example
 * ```typescript
 * import { validateWorkspace } from '@hyperfrontend/versioning'
 *
 * const report = validateWorkspace(workspace)
 *
 * if (!report.valid) {
 *   console.error(`${report.errorCount} error(s) found`)
 *   for (const result of report.results) {
 *     if (!result.result.valid) {
 *       console.error(`  ${result.checkName}: ${result.result.error}`)
 *     }
 *   }
 * }
 * ```
 */
export function validateWorkspace(workspace: Workspace): ValidationReport {
  const results: ValidationCheckResult[] = []

  results.push({
    checkId: 'workspace-has-projects',
    checkName: 'Workspace has projects',
    packageName: null,
    result: validateHasProjects(workspace),
  })

  results.push({
    checkId: 'no-circular-dependencies',
    checkName: 'No circular dependencies',
    packageName: null,
    result: validateNoCircularDependencies(workspace),
  })

  for (const project of workspace.projectList) {
    results.push({
      checkId: 'valid-version',
      checkName: `Valid semver version`,
      packageName: project.name,
      result: validateProjectVersion(project),
    })

    results.push({
      checkId: 'valid-name',
      checkName: `Valid package name`,
      packageName: project.name,
      result: validateProjectName(project),
    })

    results.push({
      checkId: 'dependency-versions',
      checkName: `Internal dependency versions`,
      packageName: project.name,
      result: validateDependencyVersions(workspace, project),
    })
  }

  const errors = results.filter((r) => !r.result.valid)
  const warnings = results.filter((r) => r.result.warning !== undefined)
  const invalidPackageNames = errors
    .filter((r) => r.packageName !== null)
    .map((r) => r.packageName)
    .filter((name): name is string => name !== null)
  const invalidPackages = createSet(invalidPackageNames)

  return {
    results,
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    invalidPackages: [...invalidPackages],
  }
}

/**
 * Validates that the workspace has at least one project.
 *
 * @param workspace - Workspace to validate for project existence
 * @returns Validation result indicating success or failure
 */
function validateHasProjects(workspace: Workspace): ValidationResult {
  if (workspace.projects.size === 0) {
    return {
      valid: false,
      error: 'Workspace has no projects',
    }
  }
  return { valid: true }
}

/**
 * Validates that there are no circular dependencies.
 *
 * @param workspace - Workspace to check for circular dependencies
 * @returns Validation result indicating success or failure with cycle info
 */
function validateNoCircularDependencies(workspace: Workspace): ValidationResult {
  const visited = createSet<string>()
  const recursionStack = createSet<string>()

  /**
   * Depth-first search to detect cycles in the dependency graph.
   *
   * @param node - Current node being visited
   * @returns True if a cycle was found starting from this node
   */
  function hasCycle(node: string): boolean {
    visited.add(node)
    recursionStack.add(node)

    const deps = workspace.reverseDependencyGraph.get(node) ?? []
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) {
          return true
        }
      } else if (recursionStack.has(dep)) {
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  for (const name of workspace.projects.keys()) {
    if (!visited.has(name)) {
      if (hasCycle(name)) {
        return {
          valid: false,
          error: 'Circular dependency detected',
        }
      }
    }
  }

  return { valid: true }
}

/**
 * Validates a project's version is valid semver.
 *
 * @param project - Project to validate version for
 * @returns Validation result indicating success or failure
 */
function validateProjectVersion(project: Project): ValidationResult {
  const result = parseVersion(project.version)
  if (!result.success) {
    return {
      valid: false,
      error: `Invalid semver version: ${project.version}`,
    }
  }
  return { valid: true }
}

/**
 * Validates a project's package name.
 *
 * @param project - Project to validate name for
 * @returns Validation result indicating success or failure
 */
function validateProjectName(project: Project): ValidationResult {
  if (!project.name || project.name.trim() === '') {
    return {
      valid: false,
      error: 'Package name is required',
    }
  }

  const nameValidationResult = validatePackageNameFormat(project.name)
  if (!nameValidationResult.valid) {
    return {
      valid: false,
      error: `Invalid package name format: ${project.name}`,
    }
  }

  if (project.name.length > 214) {
    return {
      valid: false,
      error: 'Package name exceeds 214 characters',
    }
  }

  return { valid: true }
}

/**
 * Validates that internal dependency versions are satisfiable.
 *
 * @param workspace - Workspace containing all projects
 * @param project - Project to validate dependencies for
 * @returns Validation result with warnings for unsatisfied versions
 */
function validateDependencyVersions(workspace: Workspace, project: Project): ValidationResult {
  const warnings: string[] = []

  for (const depName of project.internalDependencies) {
    const dep = workspace.projects.get(depName)
    if (!dep) {
      continue
    }

    const depTypes = <const>['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    let versionRange: string | undefined

    for (const depType of depTypes) {
      const deps = project.packageJson[depType]
      if (deps?.[depName]) {
        versionRange = deps[depName]
        break
      }
    }

    if (versionRange) {
      const depVersionResult = parseVersion(dep.version)
      if (depVersionResult.success && depVersionResult.version && !isWorkspaceVersion(versionRange)) {
        const rangeResult = parseRange(versionRange)
        if (rangeResult.success && rangeResult.range) {
          if (!satisfies(depVersionResult.version, rangeResult.range)) {
            warnings.push(`${depName}@${dep.version} does not satisfy ${versionRange}`)
          }
        }
      }
    }
  }

  if (warnings.length > 0) {
    return {
      valid: true,
      warning: warnings.join('; '),
    }
  }

  return { valid: true }
}

/**
 * Validates npm package name format without using complex regex.
 * This avoids ReDoS vulnerabilities from backtracking regex patterns.
 *
 * @param name - Package name to validate
 * @returns Validation result
 */
function validatePackageNameFormat(name: string): {
  /** Whether the package name format is valid. */
  valid: boolean
} {
  const isValidChar = (char: string): boolean => {
    const code = char.charCodeAt(0)
    return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 95 || code === 46
  }

  const isValidFirstChar = (char: string): boolean => {
    const code = char.charCodeAt(0)
    return (code >= 97 && code <= 122) || (code >= 48 && code <= 57)
  }

  if (name.startsWith('@')) {
    const slashIndex = name.indexOf('/')
    if (slashIndex === -1 || slashIndex === 1 || slashIndex === name.length - 1) {
      return { valid: false }
    }

    const scope = <string>name.slice(1, slashIndex)
    if (!isValidFirstChar(<string>scope[0])) return { valid: false }
    for (const char of scope) {
      if (!isValidChar(char)) return { valid: false }
    }

    const packageName = <string>name.slice(slashIndex + 1)
    if (!isValidFirstChar(<string>packageName[0])) return { valid: false }
    for (const char of packageName) {
      if (!isValidChar(char)) return { valid: false }
    }
  } else {
    if (!isValidFirstChar(<string>name[0])) return { valid: false }
    for (const char of name) {
      if (!isValidChar(char)) return { valid: false }
    }
  }

  return { valid: true }
}

/**
 * Checks if a version range is a workspace protocol version.
 *
 * @param versionRange - Version range string to check
 * @returns True if the range uses workspace protocol
 */
function isWorkspaceVersion(versionRange: string): boolean {
  return versionRange.startsWith('workspace:') || versionRange === '*' || versionRange === 'link:'
}

/**
 * Validates a single project.
 *
 * @param project - The project to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * import { discoverProject, validateProject } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/my-lib')
 * if (project) {
 *   const result = validateProject(project)
 *   if (!result.valid) {
 *     console.error('Validation failed:', result.error)
 *   }
 * }
 * ```
 */
export function validateProject(project: Project): ValidationResult {
  const versionResult = validateProjectVersion(project)
  if (!versionResult.valid) {
    return versionResult
  }

  const nameResult = validateProjectName(project)
  if (!nameResult.valid) {
    return nameResult
  }

  return { valid: true }
}

/**
 * Creates a summary of the validation report.
 *
 * @param report - Report object from workspace validation
 * @returns Human-readable summary
 *
 * @example
 * ```typescript
 * import { validateWorkspace, summarizeValidation } from '@hyperfrontend/versioning'
 *
 * const report = validateWorkspace(workspace)
 * console.log(summarizeValidation(report))
 * // Output:
 * // Workspace validation passed
 * //   2 warning(s)
 * ```
 */
export function summarizeValidation(report: ValidationReport): string {
  const lines = []

  if (report.valid) {
    lines.push('Workspace validation passed')
    if (report.warningCount > 0) {
      lines.push(`  ${report.warningCount} warning(s)`)
    }
  } else {
    lines.push('Workspace validation failed')
    lines.push(`  ${report.errorCount} error(s)`)
    lines.push(`  ${report.warningCount} warning(s)`)
    lines.push('')
    lines.push('Errors:')

    for (const result of report.results) {
      if (!result.result.valid) {
        const pkg = result.packageName ? `[${result.packageName}] ` : ''
        lines.push(`  ${pkg}${result.checkName}: ${result.result.error}`)
      }
    }

    if (report.warningCount > 0) {
      lines.push('')
      lines.push('Warnings:')
      for (const result of report.results) {
        if (result.result.warning) {
          const pkg = result.packageName ? `[${result.packageName}] ` : ''
          lines.push(`  ${pkg}${result.checkName}: ${result.result.warning}`)
        }
      }
    }
  }

  return lines.join('\n')
}
