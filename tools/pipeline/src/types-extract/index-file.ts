/**
 * What one upstream file declares, imports and re-exports, read syntactically: the table a
 * reference is resolved against.
 *
 * @module types-extract/index-file
 */

import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** Where an imported binding comes from. */
export interface ImportBinding {
  /** The module specifier as written. */
  readonly module: string
  /** The exported name imported, `default` for a default import, or `*` for a namespace import. */
  readonly name: string
}

/** One name a file exports from elsewhere. */
export interface ReExport {
  /** The module specifier, or null when the name is one of the file's own bindings. */
  readonly module: string | null
  /** The name as exported by the module, or as bound locally. */
  readonly name: string
  /** The name as this file exports it. */
  readonly exported: string
}

/** One file's declarations, imports and re-exports. */
export interface FileIndex {
  /** The file's path. */
  readonly path: string
  /** The parsed file. */
  readonly sourceFile: ts.SourceFile
  /** The top-level declarations, by name; a name declared more than once lists every statement. */
  readonly declarations: ReadonlyMap<string, readonly ts.Statement[]>
  /** The imported bindings, by local name. */
  readonly imports: ReadonlyMap<string, ImportBinding>
  /** The names exported from elsewhere or from the file's own bindings. */
  readonly reExports: readonly ReExport[]
  /** The modules whose every export is re-exported. */
  readonly starExports: readonly string[]
}

/**
 * The names a statement declares at the top level.
 *
 * @param statement - The top-level statement examined
 * @returns The names, empty for a statement that declares none
 */
export function declaredNames(statement: ts.Statement): string[] {
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    return statement.name !== undefined && ts.isIdentifier(statement.name) ? [statement.name.text] : []
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
    )
  }
  return []
}

/**
 * The text of a module specifier.
 *
 * @param specifier - The specifier expression of an import or export
 * @returns Its text
 */
function specifierText(specifier: ts.Expression): string {
  return (specifier as ts.StringLiteral).text
}

/**
 * Indexes one file.
 *
 * @param path - The file's path, kept as the index's identity
 * @param text - The file's source text
 * @returns The declarations, imports and re-exports found
 */
export function indexFile(path: string, text: string): FileIndex {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declarations = createMap<string, ts.Statement[]>()
  const imports = createMap<string, ImportBinding>()
  const reExports: ReExport[] = []
  const starExports: string[] = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const module = specifierText(statement.moduleSpecifier)
      const clause = statement.importClause
      if (clause === undefined) continue
      if (clause.name !== undefined) imports.set(clause.name.text, { module, name: 'default' })
      const bindings = clause.namedBindings
      if (bindings === undefined) continue
      if (ts.isNamespaceImport(bindings)) {
        imports.set(bindings.name.text, { module, name: '*' })
      } else {
        for (const element of bindings.elements)
          imports.set(element.name.text, { module, name: (element.propertyName ?? element.name).text })
      }
    } else if (ts.isExportDeclaration(statement)) {
      const module = statement.moduleSpecifier === undefined ? null : specifierText(statement.moduleSpecifier)
      if (statement.exportClause === undefined) {
        if (module !== null) starExports.push(module)
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          reExports.push({ module, name: (element.propertyName ?? element.name).text, exported: element.name.text })
        }
      }
    } else {
      for (const name of declaredNames(statement)) {
        const existing = declarations.get(name)
        if (existing === undefined) declarations.set(name, [statement])
        else existing.push(statement)
      }
    }
  }
  return { path, sourceFile, declarations, imports, reExports, starExports }
}
