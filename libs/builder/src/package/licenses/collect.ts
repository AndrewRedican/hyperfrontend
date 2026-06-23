import type { PackageJson } from '../../models'
import type { ThirdPartyLicenseEntry } from './types'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { logger } from '@hyperfrontend/logging'
import { exists, join, readDirectory, readFileContent, readJsonFile } from '@hyperfrontend/project-scope/core'
import { constructLicenseUrl } from './license-url'

const log = logger.channel('builder:package:licenses')

const matchPattern = (content: string, source: string): boolean =>
  // eslint-disable-next-line workspace/no-unsafe-regex -- @preserve: SPDX patterns are static, vetted strings declared inline
  createRegExp(source, 'i').test(content)

const findLicenseFile = (packageDir: string): string | null => {
  const match = readDirectory(packageDir).find((f) => f.isFile && /^license(\.md|\.txt)?$/i.test(f.name))
  return match?.name ?? null
}

const detectLicenseFromContent = (content: string): string | null => {
  if (matchPattern(content, 'MIT License')) return 'MIT'
  if (matchPattern(content, 'Apache License.*Version 2\\.0')) return 'Apache-2.0'
  if (matchPattern(content, 'BSD 3-Clause License')) return 'BSD-3-Clause'
  if (matchPattern(content, 'BSD 2-Clause License')) return 'BSD-2-Clause'
  if (matchPattern(content, 'ISC License')) return 'ISC'
  if (matchPattern(content, 'GNU General Public License.*version 3')) return 'GPL-3.0'
  if (matchPattern(content, 'GNU Lesser General Public License.*version 3')) return 'LGPL-3.0'
  if (matchPattern(content, 'Mozilla Public License.*2\\.0')) return 'MPL-2.0'
  return null
}

const resolvePackageDir = (workspaceRoot: string, depName: string): string =>
  depName.startsWith('@') ? join(workspaceRoot, 'node_modules', ...depName.split('/')) : join(workspaceRoot, 'node_modules', depName)

const collectDependencyLicense = (depName: string, workspaceRoot: string): ThirdPartyLicenseEntry | null => {
  const packageDir = resolvePackageDir(workspaceRoot, depName)
  const pkgPath = join(packageDir, 'package.json')

  if (!exists(pkgPath)) {
    log.warn(`could not find package.json for ${depName}`)
    return null
  }

  const pkg = readJsonFile<PackageJson>(pkgPath)
  const licenseFileName = findLicenseFile(packageDir)
  let licenseType = typeof pkg.license === 'string' ? pkg.license : 'Unknown'

  if (licenseFileName) {
    const detected = detectLicenseFromContent(readFileContent(join(packageDir, licenseFileName)))
    if (detected) licenseType = detected
  }

  const licenseUrl = licenseFileName ? constructLicenseUrl(pkg.repository, licenseFileName) : null
  return { name: depName, licenseType, licenseUrl }
}

/**
 * Collects license information for every external dependency of the project
 * being built.
 *
 * The dependency list is supplied by the caller (typically the resolved external
 * list from the bundle phase, with workspace-internal entries already removed).
 * For each dependency, the function locates the installed package under
 * `<workspaceRoot>/node_modules`, parses its `package.json`, scans for a LICENSE
 * file, and attempts to derive a canonical license URL from the upstream
 * repository field. Missing dependencies are logged at warn level and dropped
 * from the result.
 *
 * @param workspaceRoot - Absolute path to the workspace root containing
 * `node_modules`.
 * @param externals - List of external (non-workspace) dependency names to inspect.
 * @returns Sorted list of license entries, one per resolvable dependency.
 *
 * @example Collecting licenses for a built library's bundle phase externals
 * ```typescript
 * const entries = collectThirdPartyLicenses('/abs/repo', ['rollup', 'typescript'])
 * ```
 */
export const collectThirdPartyLicenses = (workspaceRoot: string, externals: string[]): ThirdPartyLicenseEntry[] => {
  if (externals.length === 0) return []
  const entries: ThirdPartyLicenseEntry[] = []
  for (const dep of externals) {
    const entry = collectDependencyLicense(dep, workspaceRoot)
    if (entry) entries.push(entry)
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}
