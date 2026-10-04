import type { TSESTree } from '@typescript-eslint/utils'
import { dirname, posix, relative, resolve, sep } from 'node:path'
import { ASTUtils, AST_NODE_TYPES, TSESLint } from '@typescript-eslint/utils'
import { propertyName, unwrap } from './ast'

/**
 * Module key standing in for values that come from the global scope.
 */
export const GLOBAL_MODULE = '<global>'

/**
 * Export name standing in for a default or namespace import of a whole module.
 */
export const WHOLE_MODULE = '*'

/**
 * Where a referenced value comes from.
 */
export interface ModuleReference {
  /**
   * Normalised module key: a bare specifier without `node:`, a workspace-relative POSIX
   * source path for relative imports, or {@link GLOBAL_MODULE}.
   */
  module: string
  /** The export name, or {@link WHOLE_MODULE} for a default or namespace binding. */
  name: string
}

/**
 * What resolving a binding needs to know about the file being linted.
 */
export interface BindingContext {
  /** Source code of the file being linted. */
  sourceCode: Readonly<TSESLint.SourceCode>
  /** Absolute path of the file being linted. */
  filename: string
  /** Absolute workspace root, or null outside a workspace. */
  workspaceRoot: string | null
}

/**
 * Globals that behave like an implicitly imported module.
 */
const GLOBAL_OBJECTS: readonly string[] = ['process', 'require']

/**
 * Normalises an import specifier into the key path-helper tables are matched against.
 *
 * @param specifier - The specifier as written in the import.
 * @param binding - The file the import appears in.
 * @returns The bare specifier without `node:`, or a workspace-relative POSIX path for relative imports.
 */
export function moduleKeyOf(specifier: string, binding: BindingContext): string {
  if (specifier.startsWith('node:')) return specifier.slice('node:'.length)
  if (!specifier.startsWith('.')) return specifier
  const absolute = resolve(dirname(binding.filename), specifier)
  return (binding.workspaceRoot ? relative(binding.workspaceRoot, absolute) : absolute).split(sep).join(posix.sep)
}

/**
 * Finds the declared variable an identifier refers to.
 *
 * @param id - The identifier.
 * @param sourceCode - Source code of the file being linted.
 * @returns The variable, or null when the identifier is an undeclared global.
 */
export function variableOf(id: TSESTree.Identifier, sourceCode: Readonly<TSESLint.SourceCode>): TSESLint.Scope.Variable | null {
  const variable = ASTUtils.findVariable(sourceCode.getScope(id), id)
  return variable && variable.defs.length > 0 ? variable : null
}

/**
 * Reads the value a variable is known to hold: the initialiser of a `const`, or the single
 * value ever written to a `let` or `var`. Destructured and loop-bound variables have none.
 *
 * @param variable - The variable to read.
 * @returns The value expression, or null when the variable has no single known value.
 */
export function singleValueOf(variable: TSESLint.Scope.Variable): TSESTree.Expression | null {
  if (variable.defs.length !== 1) return null
  const def = variable.defs[0]
  if (def.type !== TSESLint.Scope.DefinitionType.Variable || def.node.id.type !== AST_NODE_TYPES.Identifier) return null
  const loop = def.parent.parent
  if (loop?.type === AST_NODE_TYPES.ForOfStatement || loop?.type === AST_NODE_TYPES.ForInStatement) return null
  if (def.parent.kind === 'const') return def.node.init
  const writes = variable.references.filter((reference) => reference.isWrite())
  return writes.length === 1 ? (writes[0].writeExpr as TSESTree.Expression | null) : null
}

/**
 * Reads the value an identifier is known to hold.
 *
 * @param id - The identifier.
 * @param sourceCode - Source code of the file being linted.
 * @returns The value expression, or null when it has no single known value.
 */
export function knownValueOf(id: TSESTree.Identifier, sourceCode: Readonly<TSESLint.SourceCode>): TSESTree.Expression | null {
  const variable = variableOf(id, sourceCode)
  return variable ? singleValueOf(variable) : null
}

/**
 * Reads the name a specifier imports.
 *
 * @param specifier - The import specifier.
 * @returns The imported export name.
 */
export function importedName(specifier: TSESTree.ImportSpecifier): string {
  return specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value
}

/**
 * Resolves `const x = require('m')` and `const { x } = require('m')` bindings.
 *
 * @param def - A variable definition.
 * @param name - The local name being resolved.
 * @param binding - The file being linted.
 * @returns The module reference, or null when the variable is not bound by `require`.
 */
function requireBindingOf(
  def: TSESLint.Scope.Definitions.VariableDefinition,
  name: string,
  binding: BindingContext
): ModuleReference | null {
  const init = def.node.init
  if (init?.type !== AST_NODE_TYPES.CallExpression || init.callee.type !== AST_NODE_TYPES.Identifier || init.callee.name !== 'require')
    return null
  const source = init.arguments[0]
  if (source?.type !== AST_NODE_TYPES.Literal || typeof source.value !== 'string') return null
  const module = moduleKeyOf(source.value, binding)
  if (def.node.id.type === AST_NODE_TYPES.Identifier) return { module, name: WHOLE_MODULE }
  if (def.node.id.type !== AST_NODE_TYPES.ObjectPattern) return null
  for (const property of def.node.id.properties) {
    if (property.type !== AST_NODE_TYPES.Property || property.computed || property.key.type !== AST_NODE_TYPES.Identifier) continue
    if (property.value.type === AST_NODE_TYPES.Identifier && property.value.name === name) return { module, name: property.key.name }
  }
  return null
}

/**
 * Resolves the module export a variable is bound to.
 *
 * @param variable - The variable to resolve.
 * @param binding - The file being linted.
 * @returns The module reference, or null when the variable is not an import.
 */
export function bindingOfVariable(variable: TSESLint.Scope.Variable, binding: BindingContext): ModuleReference | null {
  if (variable.defs.length !== 1) return null
  const def = variable.defs[0]
  if (def.type === TSESLint.Scope.DefinitionType.Variable) return requireBindingOf(def, variable.name, binding)
  if (def.type !== TSESLint.Scope.DefinitionType.ImportBinding || def.parent.type !== AST_NODE_TYPES.ImportDeclaration) return null
  const module = moduleKeyOf(def.parent.source.value, binding)
  return def.node.type === AST_NODE_TYPES.ImportSpecifier ? { module, name: importedName(def.node) } : { module, name: WHOLE_MODULE }
}

/**
 * Resolves an identifier or static member chain to the module export it reads, following
 * `path.posix` and `path.win32` into their own modules and treating `process` and
 * `require` as modules when they are not shadowed.
 *
 * @param node - An identifier or member expression.
 * @param binding - The file being linted.
 * @returns The module reference, or null when the value does not come from a module.
 */
export function referenceOf(node: TSESTree.Node, binding: BindingContext): ModuleReference | null {
  const expr = unwrap(node)
  if (expr.type === AST_NODE_TYPES.Identifier) {
    const variable = variableOf(expr, binding.sourceCode)
    return variable ? bindingOfVariable(variable, binding) : { module: GLOBAL_MODULE, name: expr.name }
  }
  if (expr.type !== AST_NODE_TYPES.MemberExpression) return null
  const name = propertyName(expr)
  const owner = name === null ? null : referenceOf(expr.object, binding)
  if (!owner || name === null) return null
  if (owner.module === GLOBAL_MODULE) return GLOBAL_OBJECTS.includes(owner.name) ? { module: owner.name, name } : null
  if (owner.name === WHOLE_MODULE) return { module: owner.module, name }
  if (owner.module === 'path' && (owner.name === 'posix' || owner.name === 'win32')) return { module: `path/${owner.name}`, name }
  return null
}
