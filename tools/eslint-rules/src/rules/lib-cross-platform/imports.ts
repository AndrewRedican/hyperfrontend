import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { Flavour } from './types'
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { compareImportSources } from '../../utils/import-analysis'
import { importedName } from './bindings'

/**
 * A `node:` module export an edit needs, as `[module, exportName]` with the module named
 * without its `node:` prefix.
 */
export type ImportRequest = readonly [module: string, name: string]

/**
 * How to reach the requested exports from a given spot in the file.
 */
export interface ImportPlan {
  /** Source text that evaluates to each requested export, in request order. */
  texts: string[]
  /** The edits that add whichever imports the texts rely on but the file lacks. */
  fixes: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix[]
}

/**
 * Lists the specifiers a module can be imported under.
 *
 * @param module - The module name without `node:`.
 * @returns The prefixed and bare specifiers.
 */
function specifiersOf(module: string): string[] {
  return [`node:${module}`, module]
}

/**
 * Tests whether an import specifier is still what its local name refers to at a spot.
 *
 * @param specifier - The import specifier.
 * @param scope - The scope at the spot.
 * @returns True when the local name is not shadowed there.
 */
function isVisible(specifier: TSESTree.ImportClause, scope: TSESLint.Scope.Scope): boolean {
  return ASTUtils.findVariable(scope, specifier.local.name)?.defs.some((def) => def.node === specifier) ?? false
}

/**
 * Inserts a new import declaration where import-order expects it.
 *
 * @param fixer - The rule fixer.
 * @param program - The file's AST.
 * @param values - The file's value imports.
 * @param source - The specifier to import from.
 * @param names - The names to import.
 * @returns The insertion fix.
 */
function insertDeclaration(
  fixer: TSESLint.RuleFixer,
  program: TSESTree.Program,
  values: readonly TSESTree.ImportDeclaration[],
  source: string,
  names: readonly string[]
): TSESLint.RuleFix {
  const line = `import { ${names.join(', ')} } from '${source}'`
  const next = values.find((declaration) => compareImportSources(declaration.source.value, source) > 0)
  if (next) return fixer.insertTextBefore(next, `${line}\n`)
  const declarations = program.body.filter((statement) => statement.type === AST_NODE_TYPES.ImportDeclaration)
  if (declarations.length > 0) return fixer.insertTextAfter(declarations[declarations.length - 1], `\n${line}`)
  return fixer.insertTextBefore(program.body[0], `${line}\n`)
}

/**
 * Works out how to reference `node:` exports at a spot, reusing the file's imports where it
 * can: a named import is used as is, a default or namespace import as `ns.name`, and a name
 * that is still free is imported. Fails when a needed name is already taken by something else.
 *
 * @param sourceCode - Source code of the file being linted.
 * @param at - The node the edit applies to, for scope lookup.
 * @param requests - The exports the edit needs.
 * @returns The plan, or null when an export cannot be referenced safely.
 */
export function planImports(
  sourceCode: Readonly<TSESLint.SourceCode>,
  at: TSESTree.Node,
  requests: readonly ImportRequest[]
): ImportPlan | null {
  const scope = sourceCode.getScope(at)
  const values = sourceCode.ast.body.filter(
    (statement): statement is TSESTree.ImportDeclaration =>
      statement.type === AST_NODE_TYPES.ImportDeclaration && statement.importKind !== 'type'
  )
  const texts: string[] = []
  const missing = createMap<string, string[]>()

  for (const [module, name] of requests) {
    const visible = values
      .filter((declaration) => specifiersOf(module).includes(declaration.source.value))
      .flatMap((declaration) => declaration.specifiers)
      .filter((specifier) => isVisible(specifier, scope))
    const named = visible.find(
      (specifier) =>
        specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind !== 'type' && importedName(specifier) === name
    )
    const whole = visible.find((specifier) => specifier.type !== AST_NODE_TYPES.ImportSpecifier)

    if (named) texts.push(named.local.name)
    else if (whole) texts.push(`${whole.local.name}.${name}`)
    else if (ASTUtils.findVariable(scope, name)) return null
    else {
      missing.set(module, [...(missing.get(module) ?? []), name])
      texts.push(name)
    }
  }

  return {
    texts,
    fixes: (fixer) =>
      [...missing].map(([module, names]) => {
        const target = values.find(
          (declaration) =>
            specifiersOf(module).includes(declaration.source.value) &&
            declaration.specifiers.some((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier)
        )
        const last = target?.specifiers[target.specifiers.length - 1]
        return last
          ? fixer.insertTextAfter(last, `, ${names.join(', ')}`)
          : insertDeclaration(fixer, sourceCode.ast, values, `node:${module}`, names)
      }),
  }
}

/**
 * Plans a reference to a `node:path` export in the requested flavour: `name` for native,
 * `posix.name` for portable.
 *
 * @param sourceCode - Source code of the file being linted.
 * @param at - The node the edit applies to.
 * @param flavour - Which separator flavour the export should have.
 * @param name - The `node:path` export.
 * @returns The plan, or null when the export cannot be referenced safely.
 */
export function planPathExport(
  sourceCode: Readonly<TSESLint.SourceCode>,
  at: TSESTree.Node,
  flavour: Flavour,
  name: string
): ImportPlan | null {
  if (flavour === 'native') return planImports(sourceCode, at, [['path', name]])
  const plan = planImports(sourceCode, at, [['path', 'posix']])
  return plan && { texts: [`${plan.texts[0]}.${name}`], fixes: plan.fixes }
}

/**
 * Plans references to the native and POSIX separators, for the canonical conversion
 * `p.split(sep).join(posix.sep)`.
 *
 * @param sourceCode - Source code of the file being linted.
 * @param at - The node the edit applies to.
 * @returns The plan whose texts are `[sep, posix.sep]`, or null when either cannot be referenced.
 */
export function planSeparators(sourceCode: Readonly<TSESLint.SourceCode>, at: TSESTree.Node): ImportPlan | null {
  const plan = planImports(sourceCode, at, [
    ['path', 'sep'],
    ['path', 'posix'],
  ])
  return plan && { texts: [plan.texts[0], `${plan.texts[1]}.sep`], fixes: plan.fixes }
}
