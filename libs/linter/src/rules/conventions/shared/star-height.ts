/**
 * Whether a regular expression can backtrack catastrophically, judged by its star height as the
 * `safe-regex` package judges it: no repetition may sit inside another, and no more than a limit
 * of repetitions may be reached. A pattern the scanner cannot read is unsafe.
 *
 * The package's reading is kept where it decides a verdict: `?` counts as a repetition, a
 * repetition of a group holding alternatives is not looked into, a repetition of something other
 * than a group is not looked into, and lookbehinds and modifier groups are unreadable.
 *
 * @module rules/conventions/shared/star-height
 */

/** A term of the scanned pattern. */
type Term = Leaf | Group | Repeat

/** A character, escape or class. */
interface Leaf {
  /** The term's kind. */
  readonly kind: 'leaf'
}

/** A parenthesised group, or the pattern itself. */
interface Group {
  /** The term's kind. */
  readonly kind: 'group'
  /** The alternatives, each a sequence of terms. */
  readonly alternatives: Term[][]
}

/** A term repeated by a quantifier. */
interface Repeat {
  /** The term's kind. */
  readonly kind: 'repeat'
  /** The term repeated. */
  readonly value: Term
}

/** The leaf every character shares. */
const LEAF: Leaf = { kind: 'leaf' }

/** Thrown when the scanner cannot read the pattern. */
const UNREADABLE = Symbol('unreadable')

/**
 * The offset after a `{n}`, `{n,}` or `{n,m}` quantifier starting after its brace.
 *
 * @param pattern - The source of a regular expression
 * @param from - The offset after the brace
 * @returns The offset after the closing brace, or -1 when no quantifier starts there
 */
function quantifierEnd(pattern: string, from: number): number {
  let index = from
  const digits = (): boolean => {
    const start = index
    while (index < pattern.length && (pattern[index] as string) >= '0' && (pattern[index] as string) <= '9') index += 1
    return index > start
  }
  if (!digits()) return -1
  if (pattern[index] === ',') {
    index += 1
    digits()
  }
  return pattern[index] === '}' ? index + 1 : -1
}

/**
 * Scans a pattern into groups, repetitions and leaves.
 *
 * @param pattern - The source of a regular expression
 * @returns The pattern's root group
 */
function scan(pattern: string): Group {
  const root: Group = { kind: 'group', alternatives: [[]] }
  const open: Group[] = [root]
  const current = (): Term[] => {
    const group = open[open.length - 1] as Group
    return group.alternatives[group.alternatives.length - 1] as Term[]
  }
  const repeat = (): void => {
    const terms = current()
    const value = terms.pop()
    if (value === undefined) throw UNREADABLE
    terms.push({ kind: 'repeat', value })
  }
  let index = 0
  while (index < pattern.length) {
    const char = pattern[index] as string
    index += 1
    if (char === '\\') {
      if (index === pattern.length) throw UNREADABLE
      index += 1
      current().push(LEAF)
    } else if (char === '[') {
      if (pattern[index] === '^') index += 1
      while (index < pattern.length && pattern[index] !== ']') index += pattern[index] === '\\' ? 2 : 1
      if (index >= pattern.length) throw UNREADABLE
      index += 1
      current().push(LEAF)
    } else if (char === '(') {
      if (pattern[index] === '?') {
        const marker = pattern[index + 1]
        index += 2
        if (marker === '<') {
          const name = /^[A-Za-z_$][\w$]*>/.exec(pattern.slice(index))
          if (name === null) throw UNREADABLE
          index += name[0].length
        } else if (marker !== '=' && marker !== '!' && marker !== ':') throw UNREADABLE
      }
      const group: Group = { kind: 'group', alternatives: [[]] }
      current().push(group)
      open.push(group)
    } else if (char === ')') {
      if (open.length === 1) throw UNREADABLE
      open.pop()
    } else if (char === '|') (open[open.length - 1] as Group).alternatives.push([])
    else if (char === '{') {
      const end = quantifierEnd(pattern, index)
      if (end === -1) current().push(LEAF)
      else {
        repeat()
        index = end
      }
    } else if (char === '?' || char === '+' || char === '*') repeat()
    else current().push(LEAF)
  }
  if (open.length > 1) throw UNREADABLE
  return root
}

/**
 * Whether a pattern is safe from catastrophic backtracking.
 *
 * @param pattern - The pattern's source
 * @param limit - The most repetitions the pattern may hold
 * @returns Whether no repetition nests in another and the limit holds; false for an unreadable pattern
 *
 * @example Reject a nested repetition and an over-limit pattern
 * ```ts
 * isSafePattern('^[a-z]+@[a-z]+\\.com$') // => true
 * isSafePattern('(a+)+$') // => false (a repetition inside a repetition)
 * isSafePattern('a?b?c?', 2) // => false (three repetitions, limit 2)
 * isSafePattern('(abc') // => false (unreadable)
 * ```
 */
export function isSafePattern(pattern: string, limit = 25): boolean {
  let root: Group
  try {
    root = scan(pattern)
  } catch {
    return false
  }
  let repetitions = 0
  const safe = (term: Term, height: number): boolean => {
    if (term.kind === 'leaf') return true
    if (term.kind === 'group') return term.alternatives.every((terms) => terms.every((inner) => safe(inner, height)))
    repetitions += 1
    if (height + 1 > 1 || repetitions > limit) return false
    const { value } = term
    return (
      value.kind !== 'group' || value.alternatives.length > 1 || (value.alternatives[0] as Term[]).every((inner) => safe(inner, height + 1))
    )
  }
  return safe(root, 0)
}
