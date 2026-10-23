/**
 * A project's lifecycle state (`metadata.lifecycle.state` in its `project.json`) attaches a
 * policy from the configuration: targets, scripts, dependencies and files it must not have, and
 * whether it must be shaped as a package never published to npm.
 *
 * @module rules/workspace/project-lifecycle-policy
 */

import type { JsonObjectNode, JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { Fix, JsonTreeNode, RuleContext, Suggestion } from '@hyperfrontend/linter'
import { readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { compileGlob, propertyOf, rootObject, wholeDocument } from '@hyperfrontend/linter/helpers'
import { readProjectFile } from './shared/project-file.ts'

/** The policy attached to one lifecycle state. */
interface Policy {
  /** Target names the project must not declare; `*` stands for any run of characters. */
  readonly forbiddenTargets?: readonly string[]
  /** Script names the project must not declare; `*` stands for any run of characters. */
  readonly forbiddenScripts?: readonly string[]
  /** Package names the project must not depend on; `*` stands for any run of characters. */
  readonly forbiddenDependencies?: readonly string[]
  /** Project-relative globs of files that must not exist. */
  readonly forbiddenFiles?: readonly string[]
  /** Whether the project must be shaped as one never published to npm. */
  readonly forbidNpmPublishing?: boolean
}

/** The lifecycle block of a project file. */
interface Lifecycle {
  /** The declared state, such as `frozen`. */
  readonly state?: unknown
}

/** The rule's options. */
interface Options {
  /** The policy per lifecycle state. */
  readonly states?: Readonly<Record<string, Policy>>
}

/** The manifest fields that declare dependencies. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** The targets that publish a package or compute the version it would publish under. */
const PUBLISHING_TARGETS = ['publish', 'version', 'version-check']

/** Directories the file check never enters. */
const UNWALKED = ['node_modules', 'dist', 'coverage', '.git', '.nx', 'out', '.next']

/**
 * Whether a name matches a pattern in which `*` stands for any run of characters.
 *
 * @param value - The target, script or package name being tested
 * @param pattern - The configured pattern, with or without wildcards
 * @returns True when the whole name matches
 */
function matchesWildcard(value: string, pattern: string): boolean {
  const parts = pattern.split('*')
  if (parts.length === 1) return value === pattern
  if (!value.startsWith(parts[0]) || !value.endsWith(parts[parts.length - 1])) return false
  let at = parts[0].length
  for (const part of parts.slice(1, -1)) {
    const found = value.indexOf(part, at)
    if (found === -1) return false
    at = found + part.length
  }
  return at <= value.length - parts[parts.length - 1].length
}

/**
 * Every file under a project directory, as project-relative POSIX paths.
 *
 * @param directory - The directory the project file sits in
 * @returns The paths in walk order
 */
function projectFiles(directory: string): string[] {
  const found: string[] = []
  const visit = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        if (!UNWALKED.includes(entry.name)) visit(join(current, entry.name), path)
      } else if (entry.isFile()) {
        found.push(path)
      }
    }
  }
  visit(directory, '')
  return found
}

/**
 * The fix that removes a property with the separator that joined it to a neighbour.
 *
 * @param object - The object the property belongs to
 * @param property - The property to remove
 * @returns The fix
 */
function removal(object: JsonObjectNode, property: JsonPropertyNode): Fix {
  const index = object.properties.indexOf(property)
  if (index > 0) return { start: object.properties[index - 1].end, end: property.end, text: '' }
  if (object.properties.length > 1) return { start: property.start, end: object.properties[1].start, text: '' }
  return { start: property.start, end: property.end, text: '' }
}

/**
 * The suggestion that removes a property.
 *
 * @param object - The object the property belongs to
 * @param property - The node to take out
 * @param name - The key, quoted in the suggestion's text
 * @returns What the user may apply to take the property out
 */
function removeSuggestion(object: JsonObjectNode, property: JsonPropertyNode, name: string): Suggestion {
  return { message: `Remove '${name}'`, fix: removal(object, property) }
}

/**
 * Checks a `project.json` against its policy.
 *
 * @param root - The project file's top-level object
 * @param state - The lifecycle state the project declares
 * @param policy - What that state forbids
 * @param context - Where to report
 */
function checkProject(root: JsonObjectNode, state: string, policy: Policy, context: RuleContext<Options | undefined, JsonTreeNode>): void {
  const targets = propertyOf(root, 'targets')?.value
  if (targets?.kind === 'object') {
    for (const target of targets.properties) {
      const name = target.key.value as string
      const where = { start: target.start, end: target.end, suggestions: [removeSuggestion(targets, target, name)] }
      if ((policy.forbiddenTargets ?? []).some((pattern) => matchesWildcard(name, pattern))) {
        context.report({ ...where, message: `A '${state}' project must not declare the '${name}' target.` })
      } else if (policy.forbidNpmPublishing === true && PUBLISHING_TARGETS.includes(name)) {
        context.report({
          ...where,
          message: `A '${state}' project is never published to npm, so it must not declare the '${name}' target.`,
        })
      }
    }
  }
  const forbiddenFiles = (policy.forbiddenFiles ?? []).map((pattern) => ({ pattern, glob: compileGlob(pattern) }))
  if (forbiddenFiles.length === 0) return
  for (const path of projectFiles(dirname(context.file.path))) {
    const match = forbiddenFiles.find(({ glob }) => glob.test(path))
    if (match !== undefined) {
      context.report({
        ...wholeDocument(context.file),
        message: `A '${state}' project must not contain '${path}', which matches the forbidden pattern '${match.pattern}'.`,
      })
    }
  }
}

/**
 * Checks a `package.json` against its policy.
 *
 * @param root - The manifest's top-level object
 * @param state - The lifecycle state the project declares
 * @param policy - What that state forbids
 * @param context - Where to report
 */
function checkPackage(root: JsonObjectNode, state: string, policy: Policy, context: RuleContext<Options | undefined, JsonTreeNode>): void {
  const scripts = propertyOf(root, 'scripts')?.value
  if (scripts?.kind === 'object') {
    for (const script of scripts.properties) {
      const name = script.key.value as string
      if ((policy.forbiddenScripts ?? []).some((pattern) => matchesWildcard(name, pattern))) {
        context.report({
          start: script.start,
          end: script.end,
          message: `A '${state}' project must not declare the '${name}' script.`,
          suggestions: [removeSuggestion(scripts, script, name)],
        })
      }
    }
  }
  for (const field of DEPENDENCY_FIELDS) {
    const section = propertyOf(root, field)?.value
    if (section?.kind !== 'object') continue
    for (const dependency of section.properties) {
      const name = dependency.key.value as string
      if ((policy.forbiddenDependencies ?? []).some((pattern) => matchesWildcard(name, pattern))) {
        context.report({
          start: dependency.start,
          end: dependency.end,
          message: `A '${state}' project must not depend on '${name}'. Remove it with \`npm uninstall ${name}\` so package-lock.json stays in step.`,
        })
      }
    }
  }
  if (policy.forbidNpmPublishing !== true) return
  const privateProperty = propertyOf(root, 'private')
  const privateMessage = `A '${state}' project is never published to npm, so its package.json must set "private": true.`
  if (privateProperty === null) context.report({ ...wholeDocument(context.file), message: privateMessage })
  else if (privateProperty.value.kind !== 'boolean' || privateProperty.value.value !== true) {
    context.report({
      start: privateProperty.start,
      end: privateProperty.end,
      message: privateMessage,
      suggestions: [
        { message: 'Add "private": true', fix: { start: privateProperty.value.start, end: privateProperty.value.end, text: 'true' } },
      ],
    })
  }
  const publishConfig = propertyOf(root, 'publishConfig')
  if (publishConfig !== null) {
    context.report({
      start: publishConfig.start,
      end: publishConfig.end,
      message: `A '${state}' project is never published to npm, so its package.json must not declare publishConfig.`,
      suggestions: [removeSuggestion(root, publishConfig, 'publishConfig')],
    })
  }
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/project-lifecycle-policy',
  language: 'json',
  fixable: false,
  create(context) {
    const fileName = basename(context.file.path)
    if (fileName !== 'project.json' && fileName !== 'package.json') return {}
    const lifecycle = readProjectFile(dirname(context.file.path))?.metadata?.['lifecycle']
    const state = typeof lifecycle === 'object' && lifecycle !== null ? (lifecycle as Lifecycle).state : undefined
    const policy = typeof state === 'string' ? context.options?.states?.[state] : undefined
    if (typeof state !== 'string' || policy === undefined) return {}
    return {
      document(node) {
        const root = rootObject(node)
        if (root === null) return
        if (fileName === 'project.json') checkProject(root, state, policy, context)
        else checkPackage(root, state, policy, context)
      },
    }
  },
})
