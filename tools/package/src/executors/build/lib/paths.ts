/**
 * Path resolution utilities for the build executor.
 *
 * Uses joinPathFragments for config paths and join() for absolute file paths.
 */
import { joinPathFragments } from '@nx/devkit'
import { join, relative } from 'node:path'

/**
 * Resolves the output path, substituting {projectRoot} placeholder.
 *
 * @param outputPath - Output path template (e.g., 'dist/{projectRoot}')
 * @param projectRelativePath - Project path relative to workspace root
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Resolved absolute output path
 */
export function resolveOutputPath(outputPath: string, projectRelativePath: string, workspaceRoot: string): string {
  const resolved = outputPath.replace('{projectRoot}', projectRelativePath)
  return join(workspaceRoot, resolved)
}

/**
 * Resolves the tsconfig path, substituting {projectRoot} placeholder.
 *
 * @param tsConfig - TypeScript config path template (e.g., '{projectRoot}/tsconfig.lib.json')
 * @param projectRelativePath - Project path relative to workspace root
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Resolved absolute tsconfig path
 */
export function resolveTsConfigPath(tsConfig: string, projectRelativePath: string, workspaceRoot: string): string {
  const resolved = tsConfig.replace('{projectRoot}', projectRelativePath)
  return join(workspaceRoot, resolved)
}

/**
 * Constructs a path fragment relative to a base directory.
 * Use this for config-style paths that don't require absolute resolution.
 *
 * @param base - Base path fragment
 * @param paths - Additional path segments to join
 * @returns Joined path fragment
 */
export function joinConfigPath(base: string, ...paths: string[]): string {
  return joinPathFragments(base, ...paths)
}

/**
 * Computes the relative path from workspace root to project root.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param projectRoot - Absolute path to project root
 * @returns Relative path from workspace to project
 */
export function getRelativeProjectPath(workspaceRoot: string, projectRoot: string): string {
  return relative(workspaceRoot, projectRoot)
}

/**
 * Constructs the source directory path for a project.
 *
 * @param projectRelativePath - Project path relative to workspace root
 * @returns Path fragment to the src directory
 */
export function getSourcePath(projectRelativePath: string): string {
  return joinPathFragments(projectRelativePath, 'src')
}

/**
 * Constructs entry point paths for platform-specific libraries.
 *
 * @param projectRelativePath - Project path relative to workspace root
 * @param entry - Entry point name ('browser' or 'node')
 * @returns Path fragment to the entry point index file
 */
export function getEntryPointPath(projectRelativePath: string, entry: 'browser' | 'node'): string {
  return joinPathFragments(projectRelativePath, 'src', entry, 'index.ts')
}

/**
 * Constructs the root entry point path (src/index.ts).
 *
 * @param projectRelativePath - Project path relative to workspace root
 * @returns Path fragment to the root index file
 */
export function getStandardEntryPath(projectRelativePath: string): string {
  return joinPathFragments(projectRelativePath, 'src', 'index.ts')
}
