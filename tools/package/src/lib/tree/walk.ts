/**
 * Visits the files of a tree that git would not ignore, reading the `.gitignore` files the tree
 * holds as it descends, so a directory git ignores is never entered and a file a nested
 * `.gitignore` re-includes is visited.
 *
 * @module lib/tree/walk
 */

import type { Tree } from './tree'
import { posix } from 'node:path'
import { matchGlobPattern } from '@hyperfrontend/project-scope/core'

/** One line of a `.gitignore`, read. */
export interface IgnoreRule {
  /** Whether a match re-includes the path. */
  readonly negated: boolean
  /** Whether the rule matches directories alone. */
  readonly directoryOnly: boolean
  /** Whether the pattern names a path under the ignore file's directory rather than a name at any depth. */
  readonly anchored: boolean
  /** The glob, without its anchors. */
  readonly glob: string
  /** The directory the ignore file sits in, relative to the root, or an empty string. */
  readonly base: string
}

/** The directories never entered, whatever the ignore files say. */
const ALWAYS_IGNORED = ['node_modules', '.git']

/**
 * A line without the trailing spaces git strips.
 *
 * @param line - The raw line
 * @returns The line, trailing spaces and tabs removed
 */
function trimEnd(line: string): string {
  let end = line.length
  while (end > 0 && (line.charAt(end - 1) === ' ' || line.charAt(end - 1) === '\t')) end -= 1
  return line.slice(0, end)
}

/**
 * The rules of one `.gitignore`.
 *
 * @param text - The file's text
 * @param base - The directory the file sits in, relative to the root, or an empty string
 * @returns The rules in order; comments and blank lines dropped
 */
export function compileIgnoreRules(text: string, base: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = trimEnd(raw)
    if (line === '' || line.startsWith('#')) continue
    const negated = line.startsWith('!')
    const body = negated ? line.slice(1) : line
    const directoryOnly = body.endsWith(posix.sep)
    const trimmed = directoryOnly ? body.slice(0, -1) : body
    const anchored = trimmed.includes(posix.sep)
    const glob = trimmed.startsWith(posix.sep) ? trimmed.slice(1) : trimmed
    rules.push({ negated, directoryOnly, anchored, glob, base })
  }
  return rules
}

/**
 * Whether one rule matches a path.
 *
 * @param rule - The rule tested
 * @param path - The path relative to the root
 * @param isDirectory - Whether the path names a directory
 * @returns True when the rule applies to the path
 */
function matches(rule: IgnoreRule, path: string, isDirectory: boolean): boolean {
  if (rule.directoryOnly && !isDirectory) return false
  let relative = path
  if (rule.base !== '') {
    if (!path.startsWith(`${rule.base}${posix.sep}`)) return false
    relative = path.slice(rule.base.length + 1)
  }
  if (rule.anchored) return matchGlobPattern(relative, rule.glob)
  return matchGlobPattern(relative, rule.glob) || matchGlobPattern(relative, `**/${rule.glob}`)
}

/**
 * Whether git would ignore a path under the rules in force.
 *
 * @param path - The path relative to the root
 * @param isDirectory - Whether the path names a directory
 * @param rules - The rules in order, the deepest `.gitignore` last
 * @returns True when the last matching rule ignores it
 */
export function isIgnored(path: string, isDirectory: boolean, rules: readonly IgnoreRule[]): boolean {
  let ignored = false
  for (const rule of rules) if (matches(rule, path, isDirectory)) ignored = !rule.negated
  return ignored
}

/**
 * The rules of a directory's own `.gitignore`, when it has one.
 *
 * @param tree - The tree read
 * @param directory - The directory relative to the root, or an empty string
 * @returns The rules, or none
 */
function rulesOf(tree: Tree, directory: string): IgnoreRule[] {
  const text = tree.read(posix.join(directory, '.gitignore'), 'utf-8')
  return text === null ? [] : compileIgnoreRules(text, directory)
}

/**
 * Visits every file under a directory of the tree that git would not ignore.
 *
 * @param tree - The tree walked
 * @param directory - Where to start, relative to the root; an empty string or `.` for the root
 * @param visitor - Called with each file's path relative to the root
 */
export function visitNotIgnoredFiles(tree: Tree, directory: string, visitor: (path: string) => void): void {
  const normalised = posix.normalize(directory === '' ? '.' : directory)
  const start = normalised === '.' ? '' : normalised.endsWith(posix.sep) ? normalised.slice(0, -1) : normalised
  const rules: IgnoreRule[] = [...rulesOf(tree, '')]
  const ancestors = start === '' ? [] : start.split(posix.sep)
  for (let depth = 1; depth <= ancestors.length; depth += 1) {
    const ancestor = ancestors.slice(0, depth).join(posix.sep)
    if (ALWAYS_IGNORED.includes(ancestors[depth - 1] as string) || isIgnored(ancestor, true, rules)) return
    rules.push(...rulesOf(tree, ancestor))
  }
  const visit = (current: string, inherited: readonly IgnoreRule[]): void => {
    for (const name of [...tree.children(current)].sort()) {
      const path = posix.join(current, name)
      if (tree.isFile(path)) {
        if (!isIgnored(path, false, inherited)) visitor(path)
      } else if (!ALWAYS_IGNORED.includes(name) && !isIgnored(path, true, inherited)) {
        visit(path, [...inherited, ...rulesOf(tree, path)])
      }
    }
  }
  visit(start, rules)
}
