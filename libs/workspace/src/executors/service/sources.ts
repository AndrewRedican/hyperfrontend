/**
 * What a service's sources may ask of `import.meta`: in the built main every module shares the
 * main's URL, so a source that would resolve a file differently once built is refused.
 *
 * @module executors/service/sources
 */

import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import ts from 'typescript'
import { readDirectoryRecursive } from '@hyperfrontend/project-scope/core'
import { workspacePath } from './options-check'

/** The source files the build reads. */
const SOURCE_FILE = /\.(?:ts|mts|cts|js|mjs|cjs)$/

/** The directory whose files build what the specs read. */
const TEST_UTILS = '__test-utils__'

/** The members of `import.meta` no module of a built main has. */
const UNBUILT_MEMBERS: readonly string[] = ['dirname', 'filename']

/** One member of `import.meta` a file reads. */
interface MetaRead {
  /** The member's name. */
  readonly member: string
  /** The line of the read, counted from 1. */
  readonly line: number
}

/**
 * Lists the source files below a directory, leaving out specs and test utilities. A link is not followed.
 *
 * @param directory - The directory, absolute
 * @param workspaceRoot - The workspace root, absolute
 * @returns The files, from the workspace root with `/` separators
 */
function sourceFiles(directory: string, workspaceRoot: string): string[] {
  return readDirectoryRecursive(directory)
    .filter((entry) => entry.isFile && SOURCE_FILE.test(entry.name) && !entry.name.includes('.spec.'))
    .map((entry) => workspacePath(workspaceRoot, entry.path))
    .filter((path) => !path.split(posix.sep).includes(TEST_UTILS))
}

/**
 * Strips what may be written around an expression without changing its value: parentheses, a cast, a non-null assertion.
 *
 * @param expression - The expression a member is read from
 * @returns The expression inside
 */
function unwrapped(expression: ts.Expression): ts.Expression {
  let inner = expression
  while (
    ts.isParenthesizedExpression(inner) ||
    ts.isAsExpression(inner) ||
    ts.isTypeAssertionExpression(inner) ||
    ts.isNonNullExpression(inner) ||
    ts.isSatisfiesExpression(inner)
  ) {
    inner = inner.expression
  }
  return inner
}

/**
 * Whether an expression is `import.meta`, whatever is written around it.
 *
 * @param expression - The expression a member is read from, if there is one
 * @returns True for `import.meta`, in parentheses or under a cast as well
 */
function isImportMeta(expression: ts.Expression | undefined): boolean {
  const inner = expression === undefined ? undefined : unwrapped(expression)
  return inner !== undefined && ts.isMetaProperty(inner) && inner.keywordToken === ts.SyntaxKind.ImportKeyword
}

/**
 * Reads the name a member is taken by where it is written as text.
 *
 * @param expression - What stands between the brackets
 * @returns The name, or none for anything but a string or a template without a substitution
 */
function literalName(expression: ts.Node): string[] {
  return ts.isStringLiteralLike(expression) ? [expression.text] : []
}

/**
 * Reads which member of the destructured value one element of a pattern takes.
 *
 * @param element - The element of an object pattern
 * @returns The member's name; none for the rest element and for a name that is computed
 */
function bindingName(element: ts.BindingElement): string[] {
  const name = element.propertyName ?? element.name
  if (element.dotDotDotToken !== undefined) return []
  if (ts.isComputedPropertyName(name)) return literalName(name.expression)
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? [name.text] : []
}

/**
 * Reads which members of `import.meta` a node takes: after a dot, between brackets as text, or by destructuring.
 *
 * @param node - Any node of a source file
 * @returns The members' names; none for a node that reads nothing of `import.meta`, or reads it by a computed name
 */
function metaMembers(node: ts.Node): string[] {
  if (ts.isPropertyAccessExpression(node) && isImportMeta(node.expression)) return [node.name.text]
  if (ts.isElementAccessExpression(node) && isImportMeta(node.expression)) return literalName(node.argumentExpression)
  if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && isImportMeta(node.initializer)) {
    return node.name.elements.flatMap(bindingName)
  }
  return []
}

/**
 * Collects the members of `import.meta` a file reads.
 *
 * @param file - The file, absolute
 * @returns The reads, in the order of the file
 */
function metaReads(file: string): MetaRead[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
  const reads: MetaRead[] = []
  const visit = (node: ts.Node): void => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    for (const member of metaMembers(node)) reads.push({ member, line })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return reads
}

/**
 * Words what is wrong with a read of `import.meta`, if anything is.
 *
 * @param member - The member read
 * @param place - Where the file lies: `in` for a module directly in `src/`, `below` for one in a directory of it, `outside` for one beside it
 * @returns The problem, or null for a read a built service resolves as the source does
 */
function problemOf(member: string, place: 'in' | 'below' | 'outside'): string | null {
  if (UNBUILT_MEMBERS.includes(member))
    return `uses import.meta.${member}, which a built service does not have; form a URL from import.meta.url.`
  if (member !== 'url' || place === 'in') return null
  return `uses import.meta.url ${place} src/, where a built service resolves it from the directory of the main; form the URL in a module directly in src/ and import it.`
}

/**
 * Lists the reads of `import.meta` in a service's sources that would resolve differently once built: a member read after a dot,
 * between brackets, or by destructuring. An `import.meta` handed to a variable first is not followed.
 *
 * @param sourceRoot - The directory of the entry module, absolute
 * @param workspaceRoot - The workspace root, absolute
 * @param beside - The files outside that directory the sources import, absolute: the service configuration
 * @returns One line per read, files in code-unit order of their paths and then by line; none for sources the build can take
 *
 * @example A nested module that forms a URL of its own
 * ```typescript
 * importMetaProblems('/repo/apps/hello/src', '/repo', ['/repo/apps/hello/service.config.ts'])
 * // => ['apps/hello/src/routes/notice.ts:5 uses import.meta.url below src/, where a built service resolves it from the directory of the main; form the URL in a module directly in src/ and import it.']
 * ```
 */
export function importMetaProblems(sourceRoot: string, workspaceRoot: string, beside: readonly string[]): readonly string[] {
  const sourcePath = workspacePath(workspaceRoot, sourceRoot)
  const placed = [
    ...sourceFiles(sourceRoot, workspaceRoot).map((path) => [path, posix.dirname(path) === sourcePath ? 'in' : 'below'] as const),
    ...beside.map((file) => [workspacePath(workspaceRoot, file), 'outside'] as const),
  ]
  return (
    placed
      // why: the order of the portable paths is the same on every platform, where the order of native ones follows the separator
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .flatMap(([path, place]) =>
        metaReads(join(workspaceRoot, path)).flatMap((read) => {
          const problem = problemOf(read.member, place)
          return problem === null ? [] : [`${path}:${read.line} ${problem}`]
        })
      )
  )
}
