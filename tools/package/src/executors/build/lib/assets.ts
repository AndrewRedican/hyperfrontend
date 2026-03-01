import type { AssetConfig, PackageJson } from './types'
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { logger, readJsonFile } from '@nx/devkit'
import { globSync } from 'glob'

/** License information for a third-party dependency */
export interface ThirdPartyLicenseEntry {
  /** Package name */
  name: string
  /** License type (e.g., 'MIT', 'Apache-2.0') */
  licenseType: string
  /** URL to the license file */
  licenseUrl: string | null
}

/**
 * Copies assets to the output directory.
 *
 * @param assets - Array of asset configurations (strings or AssetConfig objects)
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
export function copyAssets(
  assets: (string | AssetConfig)[],
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string
): void {
  for (const asset of assets) {
    if (typeof asset === 'string') {
      copyStringAsset(asset, projectRoot, outputPath)
    } else {
      copyConfigAsset(asset, outputPath, workspaceRoot)
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
function copyStringAsset(asset: string, projectRoot: string, outputPath: string): void {
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
function copyConfigAsset(asset: AssetConfig, outputPath: string, workspaceRoot: string): void {
  const inputDir = asset.input.startsWith('./') ? join(workspaceRoot, asset.input.slice(2)) : join(workspaceRoot, asset.input)

  const pattern = join(inputDir, asset.glob)
  const files = globSync(pattern, { nodir: true })

  for (const file of files) {
    const relPath = relative(inputDir, file)
    const destPath = join(outputPath, asset.output, relPath)
    mkdirSync(dirname(destPath), { recursive: true })
    copyFileSync(file, destPath)
  }
}

/**
 * Copies default assets (README, LICENSE, SECURITY, CHANGELOG) to output.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
export function copyDefaultAssets(projectRoot: string, outputPath: string, workspaceRoot: string): void {
  const readmeSrc = join(projectRoot, 'README.md')
  if (existsSync(readmeSrc)) {
    copyFileSync(readmeSrc, join(outputPath, 'README.md'))
  }

  const changelogSrc = join(projectRoot, 'CHANGELOG.md')
  if (existsSync(changelogSrc)) {
    copyFileSync(changelogSrc, join(outputPath, 'CHANGELOG.md'))
  }

  const architectureSrc = join(projectRoot, 'ARCHITECTURE.md')
  if (existsSync(architectureSrc)) {
    copyFileSync(architectureSrc, join(outputPath, 'ARCHITECTURE.md'))
  }

  const licenseSrc = join(workspaceRoot, 'LICENSE.md')
  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(outputPath, 'LICENSE.md'))
  }

  const securitySrc = join(workspaceRoot, 'SECURITY.md')
  if (existsSync(securitySrc)) {
    copyFileSync(securitySrc, join(outputPath, 'SECURITY.md'))
  }
}

/**
 * Copies FUNDING.md from workspace root if the project has funding configured.
 *
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
export function copyFundingAsset(outputPath: string, workspaceRoot: string): void {
  const fundingSrc = join(workspaceRoot, 'FUNDING.md')
  if (existsSync(fundingSrc)) {
    copyFileSync(fundingSrc, join(outputPath, 'FUNDING.md'))
  }
}

/**
 * Gets the list of default asset files to copy.
 *
 * @returns Array of default asset paths relative to their source directories
 */
export function getDefaultAssetFiles(): readonly string[] {
  return ['README.md', 'CHANGELOG.md', 'ARCHITECTURE.md', 'LICENSE.md', 'SECURITY.md'] as const
}

/**
 * Extracts external (non-@hyperfrontend/) dependencies from package.json.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Array of external dependency names
 */
export function getExternalDependencies(projectRoot: string): string[] {
  const pkgPath = join(projectRoot, 'package.json')
  if (!existsSync(pkgPath)) {
    return []
  }

  const pkg = readJsonFile<PackageJson>(pkgPath)
  const deps = pkg.dependencies ?? {}

  return Object.keys(deps).filter((name) => !name.startsWith('@hyperfrontend/'))
}

/**
 * Finds LICENSE file in a package directory with case-insensitive matching.
 *
 * @param packageDir - Absolute path to the package directory in node_modules
 * @returns Name of the LICENSE file or null if not found
 */
function findLicenseFile(packageDir: string): string | null {
  if (!existsSync(packageDir)) {
    return null
  }

  const files = readdirSync(packageDir)
  const licenseFile = files.find((file) => /^license(\.md|\.txt)?$/i.test(file))

  return licenseFile ?? null
}

/**
 * Parses a Git URL to extract repository owner, name, and hosting platform.
 *
 * @param gitUrl - Git repository URL (git+https, git://, or https format)
 * @returns Object with platform, owner and repo, or null if parsing fails
 */
function parseGitUrl(gitUrl: string): { platform: 'github' | 'gitlab' | 'bitbucket'; owner: string; repo: string } | null {
  // Normalize git+https:// and git:// to https://
  let normalizedUrl = gitUrl.replace(/^git\+/, '').replace(/^git:\/\//, 'https://')

  // Handle SSH-style URLs: git@github.com:owner/repo.git
  if (normalizedUrl.startsWith('git@')) {
    normalizedUrl = normalizedUrl.replace(/^git@([^:]+):/, 'https://$1/')
  }

  let parsed: URL
  try {
    parsed = new URL(normalizedUrl)
  } catch {
    return null
  }

  const platformMap: Record<string, 'github' | 'gitlab' | 'bitbucket'> = {
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    'bitbucket.org': 'bitbucket',
  }

  const platform = platformMap[parsed.hostname]
  if (!platform) {
    return null
  }

  // Extract owner/repo from pathname, removing leading slash and .git suffix
  const pathParts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
  if (pathParts.length < 2 || !pathParts[0] || !pathParts[1]) {
    return null
  }

  return { platform, owner: pathParts[0], repo: pathParts[1] }
}

/**
 * Constructs a URL to the license file on GitHub.
 *
 * @param repositoryUrl - Repository URL from package.json
 * @param licenseFileName - Name of the license file (e.g., 'LICENSE', 'LICENSE.md')
 * @returns URL to the license file or null if URL cannot be constructed
 */
function constructLicenseUrl(repositoryUrl: string | { type: string; url: string } | undefined, licenseFileName: string): string | null {
  if (!repositoryUrl) {
    return null
  }

  const url = typeof repositoryUrl === 'string' ? repositoryUrl : repositoryUrl.url
  const parsed = parseGitUrl(url)

  if (!parsed) {
    return null
  }

  switch (parsed.platform) {
    case 'github':
      return `https://github.com/${parsed.owner}/${parsed.repo}/blob/master/${licenseFileName}`
    case 'gitlab':
      return `https://gitlab.com/${parsed.owner}/${parsed.repo}/-/blob/main/${licenseFileName}`
    case 'bitbucket':
      return `https://bitbucket.org/${parsed.owner}/${parsed.repo}/src/master/${licenseFileName}`
    default:
      return null
  }
}

/**
 * Reads license type from package LICENSE file content.
 * Falls back to package.json license field if file cannot be parsed.
 *
 * @param licenseContent - Content of the LICENSE file
 * @returns Detected license type or 'Unknown'
 */
function detectLicenseFromContent(licenseContent: string): string | null {
  const patterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /MIT License/i, type: 'MIT' },
    { pattern: /The MIT License/i, type: 'MIT' },
    { pattern: /Apache License.*Version 2\.0/i, type: 'Apache-2.0' },
    { pattern: /BSD 3-Clause License/i, type: 'BSD-3-Clause' },
    { pattern: /BSD 2-Clause License/i, type: 'BSD-2-Clause' },
    { pattern: /ISC License/i, type: 'ISC' },
    { pattern: /GNU General Public License.*version 3/i, type: 'GPL-3.0' },
    { pattern: /GNU Lesser General Public License.*version 3/i, type: 'LGPL-3.0' },
    { pattern: /Mozilla Public License.*2\.0/i, type: 'MPL-2.0' },
  ]

  for (const { pattern, type } of patterns) {
    if (pattern.test(licenseContent)) {
      return type
    }
  }

  return null
}

/**
 * Collects license information for a single dependency.
 *
 * @param depName - Dependency package name
 * @param workspaceRoot - Absolute path to workspace root
 * @returns License entry or null if information cannot be collected
 */
function collectDependencyLicense(depName: string, workspaceRoot: string): ThirdPartyLicenseEntry | null {
  const packageDir = depName.startsWith('@')
    ? join(workspaceRoot, 'node_modules', ...depName.split('/'))
    : join(workspaceRoot, 'node_modules', depName)

  const pkgPath = join(packageDir, 'package.json')

  if (!existsSync(pkgPath)) {
    logger.warn(`Could not find package.json for ${depName}`)
    return null
  }

  const pkg = readJsonFile<PackageJson>(pkgPath)
  const licenseFileName = findLicenseFile(packageDir)

  let licenseType = typeof pkg.license === 'string' ? pkg.license : 'Unknown'

  if (licenseFileName) {
    const licensePath = join(packageDir, licenseFileName)
    const content = readFileSync(licensePath, 'utf-8')
    const detectedType = detectLicenseFromContent(content)
    if (detectedType) {
      licenseType = detectedType
    }
  }

  const licenseUrl = licenseFileName ? constructLicenseUrl(pkg.repository, licenseFileName) : null

  return {
    name: depName,
    licenseType,
    licenseUrl,
  }
}

/**
 * Collects license information for all external dependencies.
 *
 * @param projectRoot - Absolute path to the project root
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Array of third-party license entries
 */
export function collectThirdPartyLicenses(projectRoot: string, workspaceRoot: string): ThirdPartyLicenseEntry[] {
  const externalDeps = getExternalDependencies(projectRoot)

  if (externalDeps.length === 0) {
    return []
  }

  const entries: ThirdPartyLicenseEntry[] = []

  for (const dep of externalDeps) {
    const entry = collectDependencyLicense(dep, workspaceRoot)
    if (entry) {
      entries.push(entry)
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Generates THIRD_PARTY_LICENSES.md content from license entries.
 *
 * @param entries - Array of third-party license entries
 * @returns Markdown content for THIRD_PARTY_LICENSES.md
 */
export function generateThirdPartyLicensesContent(entries: ThirdPartyLicenseEntry[]): string {
  const lines: string[] = ['# Third-Party Licenses', '', '| Dependency       | Link                                                                 |', '| :--------------- | :------------------------------------------------------------------- |']

  for (const entry of entries) {
    const linkCell = entry.licenseUrl ? `[${entry.licenseType}](${entry.licenseUrl})` : entry.licenseType
    lines.push(`| \`${entry.name}\`     | ${linkCell} |`)
  }

  return lines.join('\n') + '\n'
}

/**
 * Generates and copies THIRD_PARTY_LICENSES.md to output if external dependencies exist.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 * @returns True if file was created, false otherwise
 */
export function copyThirdPartyLicensesAsset(projectRoot: string, outputPath: string, workspaceRoot: string): boolean {
  const entries = collectThirdPartyLicenses(projectRoot, workspaceRoot)

  if (entries.length === 0) {
    return false
  }

  const content = generateThirdPartyLicensesContent(entries)
  const destPath = join(outputPath, 'THIRD_PARTY_LICENSES.md')
  writeFileSync(destPath, content, 'utf-8')
  logger.info(`Generated THIRD_PARTY_LICENSES.md with ${entries.length} dependencies`)

  return true
}
