/**
 * Every entry a library exports has a path alias in `tsconfig.base.json`, the aliases of one
 * package sit together, and no alias points at a file that does not exist. The fixes remove stale
 * aliases and rewrite the `paths` block in package order.
 *
 * @module rules/workspace/lib-tsconfig-paths
 */

import type { JsonObjectNode, JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { Fix } from '../../engine/report.ts'
import type { RuleContext } from '../../engine/rule.ts'
import type { JsonTreeNode } from '../../languages/json.ts'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, posix, relative, sep } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '../../engine/rule.ts'
import { isString } from '../shared/json.ts'
import { readProjectFile } from './shared/project-file.ts'

/** The rule's options. */
interface Options {
  /** Directories under the workspace root scanned for libraries. */
  readonly libraryDirectories?: readonly string[]
  /** Path segments that exclude a directory from the scan. */
  readonly excludePatterns?: readonly string[]
}

/** One alias a library's export calls for. */
interface Expected {
  /** The alias, such as `@scope/pkg/sub`. */
  readonly alias: string
  /** The source file, workspace-relative with `/`. */
  readonly source: string
  /** The package name. */
  readonly packageName: string
  /** The export key, such as `./sub`. */
  readonly exportKey: string
}

/** One alias as written in the configuration. */
interface Mapping {
  /** The alias. */
  readonly alias: string
  /** The files it maps to. */
  readonly sources: readonly string[]
}

/** The fields of a manifest the rule reads. */
interface Manifest {
  /** The package name. */
  readonly name?: unknown
  /** The exports map. */
  readonly exports?: unknown
}

/** Directories the library scan never enters. */
const UNWALKED = ['node_modules', 'dist', '.git']

/**
 * Every directory under a root whose `project.json` declares a library.
 *
 * @param root - The absolute directory to scan
 * @returns Absolute directories in walk order
 */
function libraryDirectories(root: string): string[] {
  const found: string[] = []
  const visit = (directory: string): void => {
    if (readProjectFile(directory)?.projectType === 'library') found.push(directory)
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !UNWALKED.includes(entry.name)) visit(join(directory, entry.name))
    }
  }
  if (existsSync(root)) visit(root)
  return found
}

/**
 * The source file an export path names, when it exists.
 *
 * @param exportPath - The export path, such as `./src/sub/index.js`
 * @param directory - The library's directory
 * @param workspaceRoot - The workspace root the answer is relative to
 * @returns The workspace-relative source path, or null when no source exists
 */
function sourceOf(exportPath: string, directory: string, workspaceRoot: string): string | null {
  const relativeExport = exportPath.startsWith('./') ? exportPath.slice(2) : exportPath
  const typescript = relativeExport.replace(/\.(m?js|cjs)$/, '.ts')
  for (const candidate of [typescript, typescript.replace(/\.ts$/, '.mts'), typescript.replace(/\.ts$/, '.cts')]) {
    const absolute = join(directory, candidate)
    if (existsSync(absolute)) return relative(workspaceRoot, absolute).split(sep).join(posix.sep)
  }
  return null
}

/**
 * The aliases a library's exports call for.
 *
 * @param directory - The library's directory
 * @param workspaceRoot - The directory the source paths are made relative to
 * @returns One entry per export whose source exists
 */
function expectedOf(directory: string, workspaceRoot: string): Expected[] {
  let manifest: Manifest
  try {
    manifest = parse(readFileSync(join(directory, 'package.json'), 'utf8')) as Manifest
  } catch {
    return []
  }
  const { name, exports } = manifest
  if (typeof name !== 'string' || typeof exports !== 'object' || exports === null) return []
  const expected: Expected[] = []
  for (const [exportKey, exportValue] of entries(exports as Record<string, unknown>)) {
    if (exportKey === './package.json' || exportValue === './package.json') continue
    const target =
      typeof exportValue === 'object' && exportValue !== null ? conditionTarget(exportValue as Record<string, unknown>) : exportValue
    if (typeof target !== 'string') continue
    const source = sourceOf(target, directory, workspaceRoot)
    if (source === null) continue
    expected.push({
      alias: exportKey === '.' ? name : posix.join(name, exportKey.startsWith('./') ? exportKey.slice(2) : exportKey),
      source,
      packageName: name,
      exportKey,
    })
  }
  return expected
}

/**
 * The path a conditional export resolves to: `import`, then `default`, then the first condition.
 *
 * @param conditions - The export's condition map, such as import and require
 * @returns The path, or whatever the first condition holds
 */
function conditionTarget(conditions: Record<string, unknown>): unknown {
  return conditions['import'] ?? conditions['default'] ?? values(conditions)[0]
}

/**
 * The aliases written in a `paths` object, each with its string sources.
 *
 * @param paths - The `paths` object
 * @returns The aliases in source order
 */
function mappingsOf(paths: JsonObjectNode): Mapping[] {
  return paths.properties.map((property) => ({
    alias: property.key.value as string,
    sources: property.value.kind === 'array' ? property.value.elements.filter(isString).map((element) => element.value) : [],
  }))
}

/**
 * The `paths` block rewritten with mappings grouped by package and sorted within each.
 *
 * @param mappings - The mappings to write
 * @param expected - The expected aliases, which decide each mapping's package
 * @returns The text of the object
 */
function render(mappings: readonly Mapping[], expected: readonly Expected[]): string {
  const packageOf = (alias: string): string =>
    expected.find((entry) => alias === entry.alias || alias.startsWith(`${entry.packageName}/`))?.packageName ?? alias
  const sorted = [...mappings].sort((a, b) => packageOf(a.alias).localeCompare(packageOf(b.alias)) || a.alias.localeCompare(b.alias))
  const lines = sorted.map(
    (mapping, index) =>
      `      "${mapping.alias}": [${mapping.sources.map((source) => `"${source}"`).join(', ')}]${index === sorted.length - 1 ? '' : ','}`
  )
  return `{\n${lines.join('\n')}\n    }`
}

/**
 * The fix that removes a stale alias with the whitespace and comma that joined it.
 *
 * @param text - The document
 * @param paths - The `paths` object
 * @param property - The alias to remove
 * @returns The fix
 */
function removal(text: string, paths: JsonObjectNode, property: JsonPropertyNode): Fix {
  let start = property.start
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\n')) start -= 1
  let end = property.end
  const trailing = /^\s*,/.exec(text.slice(end, end + 20))
  if (trailing !== null) end += trailing[0].length
  else if (paths.properties.indexOf(property) > 0) {
    const leading = /,\s*$/.exec(text.slice(0, start))
    if (leading !== null) start -= leading[0].length
  }
  return { start, end, text: '' }
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/lib-tsconfig-paths',
  language: 'json',
  fixable: true,
  create(context: RuleContext<Options | undefined, JsonTreeNode>) {
    const directories = context.options?.libraryDirectories ?? []
    if (basename(context.file.path) !== 'tsconfig.base.json' || directories.length === 0) return {}
    const workspaceRoot = dirname(context.file.path)
    const excluded = context.options?.excludePatterns ?? []
    const expected = directories
      .flatMap((directory) => libraryDirectories(join(workspaceRoot, directory)))
      .filter(
        (directory) =>
          !relative(workspaceRoot, directory)
            .split(sep)
            .some((segment) => excluded.includes(segment))
      )
      .flatMap((directory) => expectedOf(directory, workspaceRoot))
    return {
      property(node, parents) {
        const property = node as JsonPropertyNode
        if (property.key.value !== 'paths' || property.value.kind !== 'object') return
        const owner = parents[parents.length - 2]
        if (owner?.kind === 'property' && owner.key.value !== 'compilerOptions') return
        checkPaths(property.value)
      },
    }

    /**
     * Reports the stale, missing and misplaced aliases of a `paths` object.
     *
     * @param paths - The object
     */
    function checkPaths(paths: JsonObjectNode): void {
      const mappings = mappingsOf(paths)
      const known = expected.map((entry) => entry.packageName)
      const orphans: string[] = []
      for (const property of paths.properties) {
        const alias = property.key.value as string
        const source = mappings.find((mapping) => mapping.alias === alias)?.sources[0] ?? ''
        const exists = source !== '' && existsSync(join(workspaceRoot, source))
        const matchesPackage = known.some((packageName) => alias === packageName || alias.startsWith(`${packageName}/`))
        if (exists || (matchesPackage && source === '')) continue
        orphans.push(alias)
        context.report({
          start: property.start,
          end: property.end,
          message: matchesPackage
            ? `Path mapping '${alias}' points to a file that does not exist: '${source}'. Remove this stale mapping.`
            : `Path mapping '${alias}' does not match any library and the file does not exist: '${source}'. Remove this stale mapping.`,
          fix: removal(context.file.text, paths, property),
        })
      }
      const kept = mappings.filter((mapping) => !orphans.includes(mapping.alias))
      const missing = expected
        .filter((entry) => !mappings.some((mapping) => mapping.alias === entry.alias))
        .sort((a, b) => a.alias.localeCompare(b.alias))
      const where = { start: paths.start, end: paths.end }
      missing.forEach((entry, index) => {
        context.report({
          ...where,
          message: `Library '${entry.packageName}' export '${entry.exportKey}' is missing from tsconfig.base.json paths. Expected path alias '${entry.alias}' → '${entry.source}'.`,
          ...(index === 0
            ? {
                fix: {
                  ...where,
                  text: render([...kept, ...missing.map((item) => ({ alias: item.alias, sources: [item.source] }))], expected),
                },
              }
            : {}),
        })
      })
      if (missing.length > 0) return
      const positions: Record<string, number[]> = {}
      kept.forEach((mapping, index) => {
        const owner = expected.find((entry) => mapping.alias === entry.alias || mapping.alias.startsWith(`${entry.packageName}/`))
        if (owner !== undefined) (positions[owner.packageName] ??= []).push(index)
      })
      for (const [packageName, indices] of entries(positions)) {
        if (indices.every((index, at) => at === 0 || index === indices[at - 1] + 1)) continue
        context.report({
          ...where,
          message: `Path mappings for ${packageName} are not co-located. Reorganize paths to group them by package.`,
          fix: { ...where, text: render(kept, expected) },
        })
        return
      }
    }
  },
})
