/**
 * Every source file of a project is either read by a hand-kept named input of `hf.json` or named
 * outside it in the rule's options, so a module added later cannot be left out of the input unnoticed.
 *
 * @module rules/workspace/named-input-coverage
 */

import type { JsonNode, JsonObjectNode } from '@hyperfrontend/json-utils'
import type { JsonTreeNode, RuleContext } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { compileGlob, isString, rootObject, wholeDocument } from '@hyperfrontend/linter/helpers'
import { fileFilterOf, Role, roleOf } from '@hyperfrontend/workspace/graph'
import { lastPropertyOf } from './shared/last-property.ts'
import { sweep } from './shared/sweep.ts'

/** The rule's options. */
interface Options {
  /** The named input of `hf.json` held to the project's sources. */
  readonly input?: string
  /** The project whose `src` directory the input is checked against, workspace-relative with `/`. */
  readonly projectRoot?: string
  /** Globs, relative to the project root, of the source files deliberately left out of the input; none when left out. */
  readonly outside?: readonly string[]
}

/** What a named input stands for. */
interface Expansion {
  /** Its file patterns, `{projectRoot}` still unreplaced. */
  readonly patterns: readonly string[]
  /** What is wrong with each named input on the way that the workspace could not read, each fault once. */
  readonly faults: readonly string[]
}

/** One source file the input has to account for. */
interface Source {
  /** Its path, workspace-relative with `/`. */
  readonly path: string
  /** The directories that hold it below `src`, outermost first, each workspace-relative with `/`. */
  readonly directories: readonly string[]
  /** Whether the input reads it. */
  readonly read: boolean
  /** Whether a `!` pattern of the input keeps it out, whatever else the input reads. */
  readonly negated: boolean
}

/** One pattern of the `outside` option with the source files it matches. */
interface Outside {
  /** The pattern as the configuration wrote it. */
  readonly pattern: string
  /** The source files it matches. */
  readonly sources: readonly Source[]
}

/** The named input every workspace has, and what it stands for where `hf.json` does not define it. */
const DEFAULT = { name: 'default', pattern: '{projectRoot}/**/*' } as const

/** The roles a file under `src` is never asked about in: a spec or a test helper, and the test setup module. */
const TEST_MATERIAL: ReadonlySet<Role> = createSet<Role>([Role.Spec, Role.TestConfig])

/**
 * Whether the workspace can read a text, which it does with `JSON.parse` and nothing more lenient.
 *
 * @param text - The file's text
 * @returns False for a text with a comment, a trailing comma or anything else `JSON.parse` refuses
 */
function isStrictJson(text: string): boolean {
  try {
    parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * The object that defines the named inputs.
 *
 * @param node - The node a `document` listener received
 * @returns The value of `namedInputs`, or null when the document has none written as an object
 */
function namedInputsOf(node: JsonTreeNode): JsonObjectNode | null {
  const root = rootObject(node)
  const inputs = root === null ? null : lastPropertyOf(root, 'namedInputs')
  return inputs !== null && inputs.value.kind === 'object' ? inputs.value : null
}

/**
 * A string field of an input written as an object.
 *
 * @param entry - The input, one element of a named input's list
 * @param name - The key to read, `fileset` or `input`
 * @returns The string, undefined when the input has no such field, or null when the field is not a string
 */
function fieldOf(entry: JsonObjectNode, name: string): string | null | undefined {
  const value = lastPropertyOf(entry, name)?.value
  if (value === undefined) return undefined
  return isString(value) ? value.value : null
}

/**
 * The file patterns a named input stands for, read from the document being linted as the workspace expands it.
 *
 * @param inputs - The object that defines the named inputs
 * @param input - The named input's name
 * @param subject - What the rule checks, for the faults: the files of the project the input reads
 * @returns The patterns, and what the workspace could not read on the way
 */
function expansionOf(inputs: JsonObjectNode, input: string, subject: string): Expansion {
  // why: a property's key is always a string literal, and a key written twice is read as its last value.
  const named = createMap(inputs.properties.map((property): [string, JsonNode] => [property.key.value as string, property.value]))
  const patterns: string[] = []
  const faults = createSet<string>()
  const expand = (name: string, expanding: readonly string[]): void => {
    // why: a named input that names itself, directly or through another, would otherwise expand without end.
    if (expanding.includes(name)) return
    const definition = named.get(name)
    if (definition === undefined) {
      if (name === DEFAULT.name) patterns.push(DEFAULT.pattern)
    } else if (definition.kind !== 'array') {
      faults.add(`Named input '${name}' is not written as a list of inputs, so this rule cannot tell ${subject}.`)
    } else {
      for (const entry of definition.elements) {
        if (isString(entry)) {
          if (named.has(entry.value) || entry.value === DEFAULT.name) expand(entry.value, [...expanding, name])
          else patterns.push(entry.value)
        } else {
          // why: null stands for what the workspace could not read, and an object's fileset is read before its input.
          const fileset = entry.kind === 'object' ? fieldOf(entry, 'fileset') : null
          const nested = entry.kind === 'object' && fileset === undefined ? fieldOf(entry, 'input') : undefined
          if (typeof fileset === 'string') patterns.push(fileset)
          else if (typeof nested === 'string') expand(nested, [...expanding, name])
          else if (fileset === null || nested === null) {
            faults.add(
              `Named input '${name}' holds an entry that is not an input (a string, or an object whose 'fileset' or 'input' is a string), so this rule cannot tell ${subject}.`
            )
          }
        }
      }
    }
  }
  expand(input, [])
  return { patterns, faults: [...faults] }
}

/**
 * The source files of a project, each with what the input says of it.
 *
 * @param directory - The project's `src` directory, absolute
 * @param projectRoot - The project's root, workspace-relative with `/`
 * @param patterns - The input's patterns, `{projectRoot}` unreplaced
 * @returns The files of every directory, whatever its name, in walk order; specs, test helpers and the test setup module are left out
 */
function sourcesOf(directory: string, projectRoot: string, patterns: readonly string[]): Source[] {
  const read = fileFilterOf(patterns, projectRoot)
  // why: each negation is asked by itself, as a pattern that reads, so a file counts as kept out only where a negation matches it and never because no pattern does.
  const negations = fileFilterOf(
    patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
    projectRoot
  )
  const sources: Source[] = []
  const walk = (absolute: string, parent: string, directories: readonly string[]): void => {
    sweep(absolute, (entry) => {
      const path = posix.join(parent, entry.name)
      const role = roleOf(path, projectRoot)
      if (entry.directory) walk(join(absolute, entry.name), path, [...directories, path])
      else if (!TEST_MATERIAL.has(role)) sources.push({ path, directories, read: read(path, role), negated: negations(path, role) })
      // why: the walk enters each directory by itself, since the sweep keeps out of names such as out and coverage that a source tree may use.
      return false
    })
  }
  walk(directory, posix.join(projectRoot, 'src'), [])
  return sources
}

/**
 * What to report for the source files nothing decides: each file, or the outermost directory around it that nothing has placed a file of.
 *
 * @param sources - Every source file of the project
 * @param placed - The ones the input reads or the `outside` option names
 * @returns The files and directories, workspace-relative with `/`, each once in walk order
 */
function undecidedUnits(sources: readonly Source[], placed: readonly Source[]): string[] {
  // why: a file a negation keeps out is decided, yet says nothing of the files beside it, so it holds no directory open.
  const held = createSet(placed.flatMap((source) => source.directories))
  return [
    ...createSet(
      sources
        .filter((source) => !source.negated && !placed.includes(source))
        .map((source) => source.directories.find((candidate) => !held.has(candidate)) ?? source.path)
    ),
  ]
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/named-input-coverage',
  language: 'json',
  fixable: false,
  create(context: RuleContext<Options | undefined, JsonTreeNode>) {
    if (basename(context.file.path) !== 'hf.json') return {}
    const input = context.options?.input
    const configured = context.options?.projectRoot
    const outside = context.options?.outside ?? []
    return {
      document(node) {
        if (input === undefined || configured === undefined) {
          context.report({
            ...wholeDocument(context.file),
            message:
              "This rule checks nothing without its 'input' and 'projectRoot' options: the named input to check and the project whose src directory it is checked against.",
          })
          return
        }
        if (!isStrictJson(context.file.text)) {
          context.report({
            ...wholeDocument(context.file),
            message: 'hf.json is not strict JSON, so the workspace reads no named input from it. Remove every comment and trailing comma.',
          })
          return
        }
        // why: a root written with a trailing or a doubled slash places no pattern on the project's files, so every pattern is placed on the spelling the walked paths are built with.
        const projectRoot = posix.join(configured, '.')
        const inputs = namedInputsOf(node)
        const declared = inputs === null ? null : lastPropertyOf(inputs, input)
        if (inputs === null || declared === null) {
          context.report({
            ...wholeDocument(context.file),
            message: `Named input '${input}' is not defined, so nothing says which files of ${projectRoot} it reads.`,
          })
          return
        }
        const where = { start: declared.start, end: declared.end }
        const expansion = expansionOf(inputs, input, `which files of ${projectRoot} '${input}' reads`)
        for (const message of expansion.faults) context.report({ ...where, message })
        if (expansion.faults.length > 0) return
        const directory = join(dirname(context.file.path), projectRoot, 'src')
        if (!existsSync(directory)) {
          context.report({
            ...where,
            message: `${posix.join(projectRoot, 'src')} does not exist, so named input '${input}' cannot be checked against it.`,
          })
          return
        }
        const sources = sourcesOf(directory, projectRoot, expansion.patterns)
        const named = outside.map((pattern): Outside => {
          const glob = compileGlob(posix.join(projectRoot, pattern))
          return { pattern, sources: sources.filter((source) => glob.test(source.path)) }
        })
        const placed = sources.filter((source) => source.read || named.some((entry) => entry.sources.includes(source)))
        for (const unit of undecidedUnits(sources, placed)) {
          context.report({
            ...where,
            message: `${unit} is neither read by named input '${input}' nor declared outside it. List it in the input when a change to it changes what a build emits; otherwise name it in this rule's 'outside' option.`,
          })
        }
        for (const entry of named) {
          const read = entry.sources.find((source) => source.read)
          if (read !== undefined) {
            context.report({
              ...where,
              message: `'${entry.pattern}' is declared outside named input '${input}', yet the input reads ${read.path}.`,
            })
          } else if (entry.sources.length === 0) {
            context.report({
              ...where,
              message: `'${entry.pattern}' is declared outside named input '${input}' but matches no source file of ${projectRoot}.`,
            })
          }
        }
      },
    }
  },
})
