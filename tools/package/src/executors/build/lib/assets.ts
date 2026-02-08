/**
 * Asset copying utilities for the build executor.
 *
 * Handles copying project assets and default files to the output directory.
 */
import { logger } from '@nx/devkit'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { glob } from 'glob'
import type { AssetConfig } from './types'

/**
 * Copies assets to the output directory.
 *
 * @param assets - Array of asset configurations (strings or AssetConfig objects)
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
export async function copyAssets(
  assets: (string | AssetConfig)[],
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string
): Promise<void> {
  for (const asset of assets) {
    if (typeof asset === 'string') {
      await copyStringAsset(asset, projectRoot, outputPath)
    } else {
      await copyConfigAsset(asset, outputPath, workspaceRoot)
    }
  }
}

/**
 * Copies a simple string asset from project root to output.
 *
 * @param asset - Asset filename relative to project root
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 */
async function copyStringAsset(
  asset: string,
  projectRoot: string,
  outputPath: string
): Promise<void> {
  const srcPath = join(projectRoot, asset)
  if (existsSync(srcPath)) {
    const destPath = join(outputPath, basename(asset))
    copyFileSync(srcPath, destPath)
    logger.info(`Copied ${asset}`)
  }
}

/**
 * Copies assets based on glob pattern configuration.
 *
 * @param asset - Asset configuration with input, glob, and output
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
async function copyConfigAsset(
  asset: AssetConfig,
  outputPath: string,
  workspaceRoot: string
): Promise<void> {
  const inputDir = asset.input.startsWith('./')
    ? join(workspaceRoot, asset.input.slice(2))
    : join(workspaceRoot, asset.input)

  const pattern = join(inputDir, asset.glob)
  const files = await glob(pattern, { nodir: true })

  for (const file of files) {
    const relPath = relative(inputDir, file)
    const destPath = join(outputPath, asset.output, relPath)
    mkdirSync(dirname(destPath), { recursive: true })
    copyFileSync(file, destPath)
  }
}

/**
 * Copies default assets (README, LICENSE, SECURITY) to output.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
export function copyDefaultAssets(
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string
): void {
  // Copy README from project
  const readmeSrc = join(projectRoot, 'README.md')
  if (existsSync(readmeSrc)) {
    copyFileSync(readmeSrc, join(outputPath, 'README.md'))
  }

  // Copy LICENSE from workspace root
  const licenseSrc = join(workspaceRoot, 'LICENSE.md')
  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(outputPath, 'LICENSE.md'))
  }

  // Copy SECURITY from workspace root
  const securitySrc = join(workspaceRoot, 'SECURITY.md')
  if (existsSync(securitySrc)) {
    copyFileSync(securitySrc, join(outputPath, 'SECURITY.md'))
  }
}

/**
 * Gets the list of default asset files to copy.
 *
 * @returns Array of default asset paths relative to their source directories
 */
export function getDefaultAssetFiles(): readonly string[] {
  return ['README.md', 'LICENSE.md', 'SECURITY.md'] as const
}
