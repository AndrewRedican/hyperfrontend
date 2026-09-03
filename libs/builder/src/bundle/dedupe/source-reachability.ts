import ts from 'typescript'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, getDirname, join, readFileContent } from '@hyperfrontend/project-scope/core'

const collectSpecifiers = (source: string): string[] => {
  const sourceFile = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const specifiers: string[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      specifiers.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
      const argument = node.arguments[0]
      if (argument !== undefined && ts.isStringLiteralLike(argument)) specifiers.push(argument.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

const resolveRelativeSource = (fromFile: string, specifier: string): string | null => {
  const base = join(getDirname(fromFile), specifier)
  const asFile = `${base}.ts`
  if (exists(asFile)) return asFile
  const asIndex = join(base, 'index.ts')
  if (exists(asIndex)) return asIndex
  return null
}

/**
 * Walks the first-party import graph from a library's entry sources and returns
 * every `.ts` module file reachable through relative specifiers.
 *
 * Both static `import` / `export ... from` declarations and string-literal
 * dynamic `import()` calls are followed. Bare specifiers (dependencies and
 * workspace packages) and non-`.ts` targets (e.g. imported `.json` data) are
 * outside the graph, as is any resolution escaping `srcRoot`. Files a library
 * carries but never imports from an entry point — spec-only fixtures above all —
 * are unreachable by construction, which is what keeps their declarations out of
 * the dedupe ownership index.
 *
 * @param entryFiles - Absolute paths of the entry point source files.
 * @param srcRoot - Absolute path to the project's `src/` directory; reachability
 * never leaves it.
 * @returns Absolute paths of every reachable source file, entry files included.
 *
 * @example Reachable modules of a single-entry library
 * ```typescript
 * const files = collectReachableSources(['/abs/libs/foo/src/index.ts'], '/abs/libs/foo/src')
 * ```
 */
export const collectReachableSources = (entryFiles: string[], srcRoot: string): string[] => {
  const visited = createSet<string>([])
  const queue = entryFiles.filter((file) => exists(file))
  for (let next = 0; next < queue.length; next += 1) {
    const file = queue[next] as string
    // why: a `../` chain can resolve outside `src/`; such files have no module key and never participate in ownership.
    if (visited.has(file) || !file.startsWith(srcRoot) || !'/\\'.includes(file.charAt(srcRoot.length))) continue
    visited.add(file)
    for (const specifier of collectSpecifiers(readFileContent(file))) {
      if (!specifier.startsWith('.')) continue
      const resolved = resolveRelativeSource(file, specifier)
      if (resolved !== null && !visited.has(resolved)) queue.push(resolved)
    }
  }
  return from(visited)
}
