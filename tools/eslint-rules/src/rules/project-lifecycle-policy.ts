import type { Rule } from 'eslint'
import type { JSONNode, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { basename, dirname, join } from 'node:path'
import { isDirectory, readDirectory, readJsonFileIfExists } from '../utils'

/**
 * Rule identifier for the project-lifecycle-policy rule.
 */
export const RULE_NAME = 'project-lifecycle-policy'

/**
 * Policy applied to a project declaring a given lifecycle state.
 */
export interface LifecycleStatePolicy {
  /** Nx target names the project must not declare. Supports `*` wildcards. */
  forbiddenTargets?: string[]
  /** package.json script names the project must not declare. Supports `*` wildcards. */
  forbiddenScripts?: string[]
  /** Dependency names the project must not declare in any dependency field. Supports `*` wildcards. */
  forbiddenDependencies?: string[]
  /** Project-relative file globs that must not exist. Supports `*` and `**`. */
  forbiddenFiles?: string[]
  /** Whether the project must be shaped as one that is never published to npm. */
  forbidNpmPublishing?: boolean
}

/**
 * Configuration options for the project-lifecycle-policy rule.
 */
export interface RuleOptions {
  /** Policy per `metadata.lifecycle.state` value. A state with no entry is unconstrained. */
  states?: Record<string, LifecycleStatePolicy>
}

/** Dependency fields a package manifest can declare a package in. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** Nx targets that publish a package to a registry, or compute the version it would publish under. */
const PUBLISHING_TARGETS = ['publish', 'version', 'version-check']

/** Directory names never descended into while checking `forbiddenFiles`. */
const UNWALKED_DIRECTORIES = ['node_modules', 'dist', 'coverage', '.git', '.nx', 'out', '.next']

/**
 * Matches a name against a pattern where `*` stands for any run of characters.
 *
 * Built without `RegExp` so a pattern taken from user configuration can never
 * become a catastrophic backtracking hazard.
 *
 * @param value - The concrete name being tested.
 * @param pattern - The pattern, which may contain any number of `*` wildcards.
 * @returns True when the pattern matches the whole value.
 */
export function matchesWildcard(value: string, pattern: string): boolean {
  const segments = pattern.split('*')
  if (segments.length === 1) {
    return value === pattern
  }

  const first = segments[0] ?? ''
  const last = segments[segments.length - 1] ?? ''
  if (!value.startsWith(first) || !value.endsWith(last)) {
    return false
  }
  if (first.length + last.length > value.length) {
    return false
  }

  let cursor = first.length
  const ceiling = value.length - last.length
  for (let index = 1; index < segments.length - 1; index += 1) {
    const segment = segments[index] ?? ''
    if (segment === '') {
      continue
    }
    const found = value.indexOf(segment, cursor)
    if (found === -1 || found + segment.length > ceiling) {
      return false
    }
    cursor = found + segment.length
  }
  return true
}

/**
 * Matches a slash-separated path against a glob where `*` spans one segment
 * and `**` spans any number of segments.
 *
 * @param pathSegments - The path being tested, already split on `/`.
 * @param patternSegments - The glob, already split on `/`.
 * @param pathIndex - Index into `pathSegments` to resume from.
 * @param patternIndex - Index into `patternSegments` to resume from.
 * @returns True when the glob matches the whole path.
 */
function matchSegments(pathSegments: string[], patternSegments: string[], pathIndex: number, patternIndex: number): boolean {
  if (patternIndex === patternSegments.length) {
    return pathIndex === pathSegments.length
  }

  const pattern = patternSegments[patternIndex] ?? ''
  if (pattern === '**') {
    for (let skip = pathIndex; skip <= pathSegments.length; skip += 1) {
      if (matchSegments(pathSegments, patternSegments, skip, patternIndex + 1)) {
        return true
      }
    }
    return false
  }

  if (pathIndex === pathSegments.length) {
    return false
  }
  if (!matchesWildcard(pathSegments[pathIndex] ?? '', pattern)) {
    return false
  }
  return matchSegments(pathSegments, patternSegments, pathIndex + 1, patternIndex + 1)
}

/**
 * Matches a project-relative path against a file glob.
 *
 * @param relativePath - Path relative to the project root, using `/` separators.
 * @param pattern - Glob supporting `*` and `**`.
 * @returns True when the glob matches the path.
 */
export function matchesGlob(relativePath: string, pattern: string): boolean {
  return matchSegments(relativePath.split('/'), pattern.split('/'), 0, 0)
}

/**
 * Lists every file under a project root, as paths relative to it.
 *
 * Build output, dependencies and version-control metadata are never descended
 * into: a frozen project's `dist` mirrors its source, so walking it would
 * report the same violation twice under a path nobody edits.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns Project-relative file paths, using `/` separators.
 */
function collectProjectFiles(projectRoot: string): string[] {
  const found: string[] = []

  const walk = (directory: string, prefix: string): void => {
    for (const entry of readDirectory(directory)) {
      if (UNWALKED_DIRECTORIES.includes(entry)) {
        continue
      }
      const absolute = join(directory, entry)
      const relative = prefix === '' ? entry : `${prefix}/${entry}`
      if (isDirectory(absolute)) {
        found.push(relative)
        walk(absolute, relative)
      } else {
        found.push(relative)
      }
    }
  }

  walk(projectRoot, '')
  return found
}

/**
 * The lifecycle block a project.json may carry under `metadata`.
 */
interface LifecycleMetadata {
  /** Where the project sits in its life: `planned`, `active`, `frozen`, `retired`. */
  state?: unknown
}

/**
 * The `metadata` block a project.json may carry.
 */
interface ProjectMetadata {
  /** Lifecycle declaration, absent on any project still under active development. */
  lifecycle?: LifecycleMetadata
}

/**
 * The slice of project.json this rule reads.
 */
interface LifecycleProjectJson {
  /** Free-form project metadata, of which only `lifecycle` is read here. */
  metadata?: ProjectMetadata
}

/**
 * Reads the lifecycle state a project declares in its `project.json`.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns The declared state, or null when the project declares none.
 */
function readLifecycleState(projectRoot: string): string | null {
  const projectJson = readJsonFileIfExists<LifecycleProjectJson>(join(projectRoot, 'project.json'))
  const state = projectJson?.metadata?.lifecycle?.state
  return typeof state === 'string' ? state : null
}

/**
 * Reads a JSON property's key name, whichever spelling the source used.
 *
 * @param node - The property node.
 * @returns The key name, or null when it is not a plain string key.
 */
function keyNameOf(node: JSONProperty): string | null {
  const key = node.key
  if (key.type === 'JSONIdentifier') {
    return key.name
  }
  if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
    return key.value
  }
  return null
}

/**
 * Whether a property sits at the top level of the linted document.
 *
 * @param node - The property node.
 * @returns True when the property is a direct member of the root object.
 */
function isTopLevel(node: JSONProperty): boolean {
  const parent = node.parent
  return parent?.type === 'JSONObjectExpression' && parent.parent?.type === 'JSONExpressionStatement'
}

/**
 * Builds a fixer that deletes a JSON property along with the one comma that
 * held it to its siblings, leaving the surrounding object well-formed.
 *
 * @param node - The property to delete.
 * @param context - The rule context, for source text access.
 * @returns A fixer function.
 */
function removePropertyFixer(node: JSONProperty, context: Rule.RuleContext): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const source = context.sourceCode.getText()
    const [start, end] = node.range
    let from = start
    let to = end

    // why: a trailing comma belongs to this property, so take it and stop; otherwise the
    // why: preceding comma is the one holding a last property in place, so take that instead.
    let after = to
    while (after < source.length && /\s/.test(source[after] ?? '')) {
      after += 1
    }
    if (source[after] === ',') {
      to = after + 1
    } else {
      let before = from - 1
      while (before >= 0 && /\s/.test(source[before] ?? '')) {
        before -= 1
      }
      if (source[before] === ',') {
        from = before
      }
    }

    return fixer.removeRange([from, to])
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Hold projects to the policy their declared lifecycle state carries',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/project-lifecycle-policy.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          states: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                forbiddenTargets: { type: 'array', items: { type: 'string' } },
                forbiddenScripts: { type: 'array', items: { type: 'string' } },
                forbiddenDependencies: { type: 'array', items: { type: 'string' } },
                forbiddenFiles: { type: 'array', items: { type: 'string' } },
                forbidNpmPublishing: { type: 'boolean' },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenTarget: "A '{{state}}' project must not declare the '{{name}}' target.",
      forbiddenScript: "A '{{state}}' project must not declare the '{{name}}' script.",
      forbiddenDependency:
        "A '{{state}}' project must not depend on '{{name}}'. Remove it with `npm uninstall {{name}}` so package-lock.json stays in step.",
      forbiddenFile: "A '{{state}}' project must not contain '{{path}}', which matches the forbidden pattern '{{pattern}}'.",
      publishingTarget: "A '{{state}}' project is never published to npm, so it must not declare the '{{name}}' target.",
      missingPrivate: 'A \'{{state}}\' project is never published to npm, so its package.json must set "private": true.',
      forbiddenPublishConfig: "A '{{state}}' project is never published to npm, so its package.json must not declare publishConfig.",
      removeProperty: "Remove '{{name}}'",
      addPrivate: 'Add "private": true',
    },
  },

  create(context) {
    const projectRoot = dirname(context.filename)
    const manifest = basename(context.filename)

    const state = readLifecycleState(projectRoot)
    if (state === null) {
      return {}
    }

    const options = <RuleOptions>(context.options[0] ?? {})
    const policy = options.states?.[state]
    if (!policy) {
      return {}
    }

    /**
     * Reports a forbidden entry, offering removal as an editor suggestion.
     *
     * @param node - The offending property.
     * @param messageId - Which diagnostic to raise.
     * @param name - The entry name, used in both messages.
     */
    const reportRemovable = (node: JSONProperty, messageId: string, name: string): void => {
      context.report({
        node: <Rule.Node>(<unknown>node),
        messageId,
        data: { state, name },
        suggest: [{ messageId: 'removeProperty', data: { name }, fix: removePropertyFixer(node, context) }],
      })
    }

    if (manifest === 'project.json') {
      const forbiddenTargets = policy.forbiddenTargets ?? []
      const publishing = policy.forbidNpmPublishing === true

      return <Rule.RuleListener>(<unknown>{
        JSONProperty(node: JSONProperty) {
          if (!isTopLevel(node) || keyNameOf(node) !== 'targets') {
            return
          }
          const value = node.value
          if (value.type !== 'JSONObjectExpression') {
            return
          }
          for (const target of value.properties) {
            const name = keyNameOf(target)
            if (name === null) {
              continue
            }
            if (publishing && PUBLISHING_TARGETS.includes(name)) {
              reportRemovable(target, 'publishingTarget', name)
              continue
            }
            if (forbiddenTargets.some((pattern) => matchesWildcard(name, pattern))) {
              reportRemovable(target, 'forbiddenTarget', name)
            }
          }
        },

        'Program:exit'(node: JSONNode) {
          const patterns = policy.forbiddenFiles ?? []
          if (patterns.length === 0) {
            return
          }
          const files = collectProjectFiles(projectRoot)
          for (const pattern of patterns) {
            for (const path of files) {
              if (matchesGlob(path, pattern)) {
                context.report({
                  node: <Rule.Node>(<unknown>node),
                  messageId: 'forbiddenFile',
                  data: { state, path, pattern },
                })
              }
            }
          }
        },
      })
    }

    if (manifest !== 'package.json') {
      return {}
    }

    const forbiddenScripts = policy.forbiddenScripts ?? []
    const forbiddenDependencies = policy.forbiddenDependencies ?? []
    const publishing = policy.forbidNpmPublishing === true
    let privateNode: JSONProperty | null = null
    let isPrivate = false

    return <Rule.RuleListener>(<unknown>{
      JSONProperty(node: JSONProperty) {
        if (!isTopLevel(node)) {
          return
        }
        const name = keyNameOf(node)
        if (name === null) {
          return
        }

        if (name === 'private') {
          privateNode = node
          isPrivate = node.value.type === 'JSONLiteral' && node.value.value === true
          return
        }

        if (publishing && name === 'publishConfig') {
          reportRemovable(node, 'forbiddenPublishConfig', name)
          return
        }

        if (name === 'scripts' && node.value.type === 'JSONObjectExpression') {
          for (const script of node.value.properties) {
            const scriptName = keyNameOf(script)
            if (scriptName !== null && forbiddenScripts.some((pattern) => matchesWildcard(scriptName, pattern))) {
              reportRemovable(script, 'forbiddenScript', scriptName)
            }
          }
          return
        }

        if (DEPENDENCY_FIELDS.includes(name) && node.value.type === 'JSONObjectExpression') {
          for (const dependency of node.value.properties) {
            const dependencyName = keyNameOf(dependency)
            if (dependencyName === null) {
              continue
            }
            if (forbiddenDependencies.some((pattern) => matchesWildcard(dependencyName, pattern))) {
              context.report({
                node: <Rule.Node>(<unknown>dependency),
                messageId: 'forbiddenDependency',
                data: { state, name: dependencyName },
              })
            }
          }
        }
      },

      'Program:exit'(node: JSONNode) {
        if (!publishing || isPrivate) {
          return
        }
        if (privateNode !== null) {
          const declared = privateNode
          context.report({
            node: <Rule.Node>(<unknown>declared),
            messageId: 'missingPrivate',
            data: { state },
            suggest: [{ messageId: 'addPrivate', fix: (fixer) => fixer.replaceText(<Rule.Node>(<unknown>declared.value), 'true') }],
          })
          return
        }
        context.report({ node: <Rule.Node>(<unknown>node), messageId: 'missingPrivate', data: { state } })
      },
    })
  },
}

export default rule
