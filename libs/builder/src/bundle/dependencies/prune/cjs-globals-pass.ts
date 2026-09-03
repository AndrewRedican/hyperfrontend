import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { parseChunk } from './ast-utils'
import { collectIdentifierTexts, uniqueLocal } from './chunk-names'
import { collectFreeRefs } from './free-refs'
import { walkFiles } from './orphan-chunks'

/**
 * Aggregate result of the CJS-globals shim pass.
 */
export interface CjsGlobalsPassResult {
  /** ESM chunks that received a `require` / `__filename` / `__dirname` shim preamble. */
  chunksShimmed: number
}

const CJS_GLOBALS = createSet<string>(['require', '__filename', '__dirname'])

const collectTopLevelBindings = (sourceFile: ts.SourceFile): Set<string> => {
  const bound = createSet<string>([])
  const addBindingName = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      bound.add(name.text)
      return
    }
    for (const element of name.elements) if (!ts.isOmittedExpression(element)) addBindingName(element.name)
  }
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause
      if (clause.name) bound.add(clause.name.text)
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bound.add(clause.namedBindings.name.text)
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
        for (const element of clause.namedBindings.elements) bound.add(element.name.text)
    }
    if (ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations) addBindingName(decl.name)
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) bound.add(statement.name.text)
  }
  return bound
}

const freeCjsGlobalsOf = (sourceFile: ts.SourceFile): Set<string> => {
  const free = createSet<string>([])
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) continue
    collectFreeRefs(statement, free)
  }
  const bound = collectTopLevelBindings(sourceFile)
  const needed = createSet<string>([])
  for (const name of CJS_GLOBALS) if (free.has(name) && !bound.has(name)) needed.add(name)
  return needed
}

const renderShim = (needed: Set<string>, taken: Set<string>): string => {
  const imports: string[] = []
  const consts: string[] = []
  const toUrl = uniqueLocal('__cjsFileURLToPath', taken)
  if (needed.has('require')) {
    const factory = uniqueLocal('__cjsCreateRequire', taken)
    imports.push(`import { createRequire as ${factory} } from 'node:module';`)
    consts.push(`const require = ${factory}(import.meta.url);`)
  }
  if (needed.has('__filename') || needed.has('__dirname')) imports.push(`import { fileURLToPath as ${toUrl} } from 'node:url';`)
  if (needed.has('__filename')) consts.push(`const __filename = ${toUrl}(import.meta.url);`)
  if (needed.has('__dirname')) {
    const toDirname = uniqueLocal('__cjsPathDirname', taken)
    imports.push(`import { dirname as ${toDirname} } from 'node:path';`)
    consts.push(`const __dirname = ${toDirname}(${toUrl}(import.meta.url));`)
  }
  return `${[...imports, ...consts].join('\n')}\n`
}

/**
 * Prepends a Node-ESM shim for the CJS module-scope globals a bundled
 * dependency's ESM chunk still references.
 *
 * The CJS-to-ESM wrap leaves dynamic `require(...)` calls (under
 * `ignoreDynamicRequires`) and `__dirname` / `__filename` reads verbatim; the
 * CJS twin resolves them natively while the ESM chunk throws a `ReferenceError`
 * the moment evaluation reaches one — rollup's own native-binding loader is the
 * canonical case. For each ESM chunk whose top-level code has one of the three
 * names genuinely free (scope-aware, so a local `require` helper never
 * triggers), this prepends `createRequire(import.meta.url)` /
 * `fileURLToPath(import.meta.url)`-backed declarations, reproducing exactly the
 * bindings the CJS twin evaluates under.
 *
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Count of chunks that received a shim.
 *
 * @example Shimming after the orphan sweep
 * ```typescript
 * const { chunksShimmed } = shimCjsGlobalsPass(depsRootOf(context))
 * ```
 */
export const shimCjsGlobalsPass = (depsRoot: string): CjsGlobalsPassResult => {
  const result: CjsGlobalsPassResult = { chunksShimmed: 0 }
  if (!exists(depsRoot)) return result
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.esm.js', chunks)
  for (const chunk of chunks) {
    const source = readFileContent(chunk)
    const sourceFile = parseChunk(source)
    const needed = freeCjsGlobalsOf(sourceFile)
    if (needed.size === 0) continue
    writeFileContent(chunk, `${renderShim(needed, collectIdentifierTexts(sourceFile))}${source}`)
    result.chunksShimmed += 1
  }
  return result
}
