/**
 * The mentions of a package name in prose, rewritten when the package is renamed: the name where it
 * stands whole, never where it is the start or the end of a longer name.
 *
 * @module generators/shared/package-mentions
 */

/** The characters that join the parts of a package name. */
const JOINERS = '-_.~'

/** The characters a package name cannot follow without being the tail of a longer name. */
const LEADERS = `${JOINERS}@`

/** The file extensions an address of a package ends with, none of them the last part of a package name. */
const EXTENSIONS = ['svg', 'png', 'json', 'md', 'd.ts']

/** A letter or a digit, what the parts of a package name are made of. */
const NAME_CHARACTER = /^[a-zA-Z0-9]$/

/** A capital letter, what a sentence starts with and no part of a package name does after a full stop. */
const CAPITAL = /^[A-Z]$/

/**
 * Whether a file extension follows a full stop and ends there, as it does after the name of a
 * package in the address of a badge.
 *
 * @param text - The text read
 * @param index - The index just past the full stop
 * @returns Whether the full stop starts a file extension rather than a further part of a name
 */
function startsExtension(text: string, index: number): boolean {
  return EXTENSIONS.some((extension) => text.startsWith(extension, index) && !continuesName(text, index + extension.length))
}

/**
 * Whether the text carries a name on past an index: with a letter or a digit, or with a joining
 * character that one follows, a file extension and the capital of a next sentence after a full
 * stop aside.
 *
 * @param text - The text read
 * @param index - The index just past a candidate mention
 * @returns Whether the candidate is the start of a longer name
 */
function continuesName(text: string, index: number): boolean {
  const next = text.charAt(index)
  if (NAME_CHARACTER.test(next)) return true
  const after = text.charAt(index + 1)
  // why: a joining character alone is punctuation, as in a full stop ending a sentence, so it carries the name on only before a letter or a digit.
  if (!JOINERS.includes(next) || !NAME_CHARACTER.test(after)) return false
  if (next !== '.') return true
  // why: the names of packages are written in lower case, so a capital after a full stop starts the next sentence, written without its space.
  if (CAPITAL.test(after)) return false
  // why: the image of a badge is addressed by the name and a file extension, and must follow the package as its link does.
  return !startsExtension(text, index + 1)
}

/**
 * Whether a slash closes a scope: the name of a scope and its at sign lie right before it.
 *
 * @param text - The text read
 * @param slash - The index of the slash
 * @returns Whether what the slash leads into is the rest of a scoped name
 */
function closesScope(text: string, slash: number): boolean {
  let start = slash
  while (start > 0 && (NAME_CHARACTER.test(text.charAt(start - 1)) || JOINERS.includes(text.charAt(start - 1)))) start--
  return text.charAt(start - 1) === '@'
}

/**
 * Whether the text leads into a name at an index: with a letter, a digit, a joining character, an
 * at sign or the slash of a scope before it.
 *
 * @param text - The text read
 * @param index - The index a candidate mention starts at
 * @returns Whether the candidate is the tail of a longer name
 */
function precedesName(text: string, index: number): boolean {
  const previous = text.charAt(index - 1)
  // why: a slash joins a name to its scope alone; after any other segment it is the slash of an address or a path, where the name stands whole.
  if (previous === '/') return closesScope(text, index - 1)
  // why: the start of the text has no character before it, and every string includes the empty one.
  return previous !== '' && (NAME_CHARACTER.test(previous) || LEADERS.includes(previous))
}

/**
 * Rewrites the mentions of a package in a text, where the name stands whole. A longer name that
 * starts with it, such as `@acme/core-ui` beside `@acme/core`, is left alone; so is a name without
 * a scope at the end of a longer name, such as `core` in `@acme/core` or `lodash.core`. An entry of
 * the package, a version or a file extension after it and the punctuation around it do not make the
 * name longer, and neither does a full stop before a capital letter, which ends a sentence whose
 * space was left out: `@acme/core.Then` mentions `@acme/core`, where `@acme/core.then` is a longer
 * name. A name without a scope is rewritten after every slash but the one of a scope: the address
 * of a registry or a badge follows the package, and so does a path through a directory that has
 * the same name.
 *
 * @param text - The text read
 * @param currentPackageName - The package name to replace
 * @param newPackageName - The replacement package name
 * @returns The text with every whole mention rewritten
 *
 * @example A sibling package keeps its name
 * ```typescript
 * replacePackageMentions('npm install @acme/core @acme/core-ui', '@acme/core', '@acme/kernel')
 * // => 'npm install @acme/kernel @acme/core-ui'
 * replacePackageMentions("import '@acme/core/testing'", '@acme/core', '@acme/kernel')
 * // => "import '@acme/kernel/testing'"
 * replacePackageMentions('core is the base of @acme/core', 'core', 'kernel')
 * // => 'kernel is the base of @acme/core'
 * ```
 *
 * @example The addresses that name the package follow it
 * ```typescript
 * replacePackageMentions('https://img.shields.io/npm/v/@acme/core.svg', '@acme/core', '@acme/kernel')
 * // => 'https://img.shields.io/npm/v/@acme/kernel.svg'
 * replacePackageMentions('https://www.npmjs.com/package/core and libs/core', 'core', 'kernel')
 * // => 'https://www.npmjs.com/package/kernel and libs/kernel'
 * ```
 */
export function replacePackageMentions(text: string, currentPackageName: string, newPackageName: string): string {
  // why: an empty name is found at every index without the search ever advancing.
  if (currentPackageName === '') return text
  // why: a scoped name is delimited by its own at sign, so nothing before it can make it the tail of a longer name.
  const delimited = currentPackageName.startsWith('@')
  let result = ''
  let cursor = 0
  for (let at = text.indexOf(currentPackageName); at !== -1; at = text.indexOf(currentPackageName, cursor)) {
    const whole = !continuesName(text, at + currentPackageName.length) && (delimited || !precedesName(text, at))
    result += `${text.slice(cursor, at)}${whole ? newPackageName : currentPackageName}`
    cursor = at + currentPackageName.length
  }
  return `${result}${text.slice(cursor)}`
}
