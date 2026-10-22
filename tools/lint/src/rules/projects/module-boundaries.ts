/**
 * Imports between workspace projects stay inside the boundaries the configuration draws: another
 * project is imported by its alias, never by a relative or absolute path; a project never imports
 * its own alias, never closes a cycle, never imports an application, never imports statically
 * what it loads lazily elsewhere; a buildable library imports only buildable libraries; and a
 * project imports only projects whose tags its constraints allow.
 *
 * @module rules/projects/module-boundaries
 */

import type { Node } from '../../code/model.ts'
import type { RuleContext } from '../../engine/rule.ts'
import type { WorkspaceGraph } from '../../graph/build.ts'
import type { ProjectRecord } from '../../graph/model.ts'
import { dirname, posix } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { workspaceRelativePath } from '@hyperfrontend/project-scope/core/path'
import { defineRule } from '../../engine/rule.ts'
import { workspaceGraph } from '../../graph/build.ts'
import { baseConfigRootOf } from '../workspace/shared/aliases.ts'
import { filesImporting, pathBetween, reachesDynamically } from './shared/reach.ts'
import { aliasImports, relativeImports } from './shared/remap.ts'

/** A tag constraint. */
export interface DependencyConstraint {
  /** The tag of the projects the constraint governs. */
  readonly sourceTag: string
  /** The tags at least one of which every imported project must carry; none means no tagged project. */
  readonly onlyDependOnLibsWithTags?: readonly string[]
}

/** The rule's options. */
export interface ModuleBoundariesOptions {
  /** Imports never checked: `prefix/**`, `prefix/*`, `prefix/** /suffix` or a regular expression. */
  readonly allow?: readonly string[]
  /** The tag constraints projects must respect. */
  readonly depConstraints?: readonly DependencyConstraint[]
  /** Whether a buildable library may import only buildable libraries. */
  readonly enforceBuildableLibDependency?: boolean
}

/** The messages, by what was broken. */
const MESSAGES = {
  acrossLibraries: 'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope',
  externals: 'External resources cannot be imported using a relative or absolute path',
  apps: 'Imports of apps are forbidden',
  nonBuildable: 'Buildable libraries cannot import or export from non-buildable libraries',
  untagged: 'A project without tags matching at least one constraint cannot depend on any libraries',
}

/** The node kinds whose `source` names a module. */
const SOURCE_KINDS = ['ImportDeclaration', 'ImportExpression', 'ExportAllDeclaration', 'ExportNamedDeclaration'] as const

/**
 * Whether an allow entry matches a specifier, as Nx reads the entry: a `/**` suffix matches the
 * prefix, a `/*` suffix one more segment, a `/** /` infix a prefix and a suffix, anything else is
 * a regular expression.
 *
 * @param entry - The allow entry
 * @param specifier - The specifier as written
 * @returns Whether the import is left alone
 */
export function allows(entry: string, specifier: string): boolean {
  if (entry.endsWith('/**')) return specifier.startsWith(entry.slice(0, -2))
  if (entry.endsWith('/*')) {
    const prefix = entry.slice(0, -1)
    return specifier.startsWith(prefix) && !specifier.slice(prefix.length).includes('/')
  }
  if (entry.includes('/**/')) {
    const [prefix, suffix] = entry.split('/**/') as [string, string]
    return specifier.startsWith(prefix) && specifier.endsWith(suffix)
  }
  // lint-disable-next-line workspace/no-unsafe-regex -- why: the configuration's own patterns, compiled as written.
  return createRegExp(entry).test(specifier)
}

/**
 * Whether a specifier is relative as Nx tells it: `.`, `..`, or starting with either and a slash.
 *
 * @param specifier - An import specifier as written
 * @returns Whether it is relative
 */
function isRelative(specifier: string): boolean {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../')
}

/**
 * Whether a specifier is an absolute path into the applications or libraries directory.
 *
 * @param specifier - An import specifier as written
 * @returns Whether it names another project by its workspace path
 */
function isWorkspacePath(specifier: string): boolean {
  return ['libs/', '/libs/', 'apps/', '/apps/'].some((prefix) => specifier.startsWith(prefix))
}

/**
 * The entry a file is, among the subpaths a project's manifest exports: the file itself when a
 * subpath other than `.` maps to it, as the previous rule compared them.
 *
 * @param project - The project whose manifest is read
 * @param file - The file, workspace-relative, or null
 * @returns The file when it is an exported entry, else null
 */
function entryOf(project: ProjectRecord, file: string | null): string | null {
  if (file === null) return null
  const found: string[] = []
  const collect = (value: unknown, subpath: string): void => {
    if (typeof value === 'string') {
      if (subpath !== '.') found.push(posix.join(project.root, value))
      return
    }
    if (value === null || typeof value !== 'object') return
    const conditions = value as Readonly<Record<string, unknown>>
    const chosen = conditions['default'] ?? conditions['import'] ?? conditions['require'] ?? conditions['node']
    if (chosen !== undefined) collect(chosen, subpath)
    else for (const [key, inner] of entries(conditions)) collect(inner, key)
  }
  collect(project.manifest?.exports, '.')
  return found.includes(file) ? file : null
}

/**
 * Whether a project has a build target.
 *
 * @param project - A graph node, whose targets are read
 * @returns Whether it is buildable
 */
function isBuildable(project: ProjectRecord): boolean {
  return project.configuration?.targets?.['build'] !== undefined
}

/**
 * The message for a cycle, its path and the files drawing each step.
 *
 * @param graph - The workspace graph
 * @param source - The importing project
 * @param target - The imported project
 * @param path - The projects from the target back to the source
 * @param file - The importing file
 * @returns The message text
 */
function cycleMessage(graph: WorkspaceGraph, source: string, target: string, path: readonly string[], file: string): string {
  const chain = path.slice(0, -1).map((name, index) => filesImporting(graph, name, path[index + 1] as string, false))
  const files = chain
    .map((step) => (step.length > 1 ? `[${step.map((item) => `\n    ${item}`).join(',')}\n  ]` : step[0]))
    .reduce((text, step) => `${text}\n- ${step}`, `- ${file}`)
  return `Circular dependency between "${source}" and "${target}" detected: ${path.reduce((text, name) => `${text} -> ${name}`, source)}\n\nCircular file chain:\n${files}`
}

/**
 * What the tag constraints say of an import, if anything.
 *
 * @param constraints - The configured constraints
 * @param source - The importing project
 * @param target - The imported project
 * @returns The message, or null when the import is allowed
 */
function constraintMessage(constraints: readonly DependencyConstraint[], source: ProjectRecord, target: ProjectRecord): string | null {
  const governing = constraints.filter((constraint) => constraint.sourceTag === '*' || source.tags.includes(constraint.sourceTag))
  if (governing.length === 0) return MESSAGES.untagged
  for (const { sourceTag, onlyDependOnLibsWithTags: allowed } of governing) {
    if (allowed === undefined) continue
    if (allowed.length > 0 && !allowed.some((tag) => tag === '*' || target.tags.includes(tag))) {
      return `A project tagged with "${sourceTag}" can only depend on libs tagged with ${allowed.map((tag) => `"${tag}"`).join(', ')}`
    }
    if (allowed.length === 0 && target.tags.length > 0) return `A project tagged with "${sourceTag}" cannot depend on any libs with tags`
  }
  return null
}

/**
 * Reports what one import breaks, if anything.
 *
 * @param context - The rule context
 * @param graph - The workspace graph
 * @param file - The importing file, workspace-relative
 * @param specifier - The specifier as written
 * @param node - The declaration, expression or call naming the module
 */
function check(
  context: RuleContext<ModuleBoundariesOptions | undefined, Node>,
  graph: WorkspaceGraph,
  file: string,
  specifier: string,
  node: Node
): void {
  const options = context.options ?? {}
  if ((options.allow ?? []).some((entry) => allows(entry, specifier))) return
  const source = graph.projectOf(file)
  if (source === null) return
  const report = (message: string, text: string | null = null): void =>
    context.report({
      start: node.start,
      end: node.end,
      message,
      fix: text === null ? undefined : { start: node.start, end: node.end, text },
    })
  const workspacePath = isWorkspacePath(specifier)
  const byPath = workspacePath
    ? graph.projectOf(specifier.replace(/^\//, ''))
    : isRelative(specifier)
      ? graph.projectOf(posix.normalize(posix.join(posix.dirname(file), specifier)))
      : null
  if ((byPath !== null && byPath !== source) || workspacePath) {
    report(MESSAGES.acrossLibraries, byPath === null ? null : aliasImports(graph, file, byPath, specifier, node))
    return
  }
  const resolution = graph.resolve(file, specifier)
  const resolved = resolution.kind === 'project' ? resolution.file : null
  const target = byPath ?? (resolution.kind === 'project' ? resolution.project : null)
  if (target === null) {
    if (isRelative(specifier) || specifier.startsWith('/')) report(MESSAGES.externals)
    return
  }
  if (target === source) {
    if (!isRelative(specifier) && entryOf(source, resolved) === entryOf(source, file)) {
      const message = `Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "${specifier}"`
      report(message, relativeImports(graph, file, specifier, node))
    }
    return
  }
  const cycle = pathBetween(graph, target.name, source.name)
  if (cycle.length > 0) {
    report(cycleMessage(graph, source.name, target.name, cycle, file))
    return
  }
  if (target.type === 'app') {
    report(MESSAGES.apps)
    return
  }
  if (
    options.enforceBuildableLibDependency === true &&
    source.type === 'lib' &&
    target.type === 'lib' &&
    isBuildable(source) &&
    !isBuildable(target)
  ) {
    report(MESSAGES.nonBuildable)
    return
  }
  if (
    node.kind === 'ImportDeclaration' &&
    node.importKind !== 'type' &&
    reachesDynamically(graph, source.name, target.name) &&
    entryOf(target, resolved) === null
  ) {
    const lazy = filesImporting(graph, source.name, target.name, true)
    report(
      `Static imports of lazy-loaded libraries are forbidden.\n\nLibrary "${target.name}" is lazy-loaded in these files:\n${lazy.map((item) => `- ${item}`).join('\n')}`
    )
    return
  }
  const constraints = options.depConstraints ?? []
  if (constraints.length === 0) return
  const message = constraintMessage(constraints, source, target)
  if (message !== null) report(message)
}

/**
 * The string a `require` or `require.resolve` call loads.
 *
 * @param node - The call
 * @returns The specifier, or null for any other call
 */
function requiredSpecifier(node: Node): string | null {
  const callee = node.callee as Node
  const isRequire =
    (callee.kind === 'Identifier' && callee.name === 'require') ||
    (callee.kind === 'MemberExpression' &&
      (callee.object as Node).kind === 'Identifier' &&
      (callee.object as Node).name === 'require' &&
      (callee.property as Node).kind === 'Identifier' &&
      (callee.property as Node).name === 'resolve')
  const argument = (node.arguments as readonly Node[])[0]
  return isRequire && argument?.kind === 'Literal' && typeof argument.value === 'string' ? argument.value : null
}

export default defineRule<ModuleBoundariesOptions | undefined, Node>({
  id: 'projects/module-boundaries',
  language: 'code',
  fixable: true,
  create(context) {
    const root = baseConfigRootOf(dirname(context.file.path))
    if (root === null) return {}
    const graph = workspaceGraph(root)
    const file = workspaceRelativePath(root, context.file.path)
    const fromSource = (node: Node): void => {
      const source = node.source as Node | null | undefined
      if (source?.kind === 'Literal' && typeof source.value === 'string') check(context, graph, file, source.value, node)
    }
    const listeners: Record<string, (node: Node) => void> = {}
    for (const kind of SOURCE_KINDS) listeners[kind] = fromSource
    listeners['CallExpression'] = (node) => {
      const specifier = requiredSpecifier(node)
      if (specifier !== null) check(context, graph, file, specifier, node)
    }
    return listeners
  },
})
