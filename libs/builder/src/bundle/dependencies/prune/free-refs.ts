import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

// how: recurses object / array destructuring, adding every bound identifier while skipping property keys and holes.
const bindingIdentifiers = (name: ts.BindingName, sink: Set<string>): void => {
  if (ts.isIdentifier(name)) {
    sink.add(name.text)
    return
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue
    bindingIdentifiers(element.name, sink)
  }
}

const isFunctionScopeBoundary = (node: ts.Node): boolean =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ts.isClassStaticBlockDeclaration(node)

// why: `var` hoists to the nearest function scope regardless of block depth, so the scan descends through blocks but never into a nested function/static-block body.
const collectHoistedVars = (root: ts.Node, sink: Set<string>): void => {
  const visit = (node: ts.Node): void => {
    if (isFunctionScopeBoundary(node)) return
    if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.BlockScoped) === 0)
      for (const decl of node.declarations) bindingIdentifiers(decl.name, sink)
    ts.forEachChild(node, visit)
  }
  visit(root)
}

const lexicalNamesOf = (statements: readonly ts.Statement[], sink: Set<string>): void => {
  for (const statement of statements) {
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0)
      for (const decl of statement.declarationList.declarations) bindingIdentifiers(decl.name, sink)
    // why: block-level function and class declarations are lexically scoped to their block in the strict-mode ESM output rollup emits.
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) sink.add(statement.name.text)
  }
}

/** Function-like signature widened with the optional body every runtime function form carries. */
interface FunctionLikeNode extends ts.SignatureDeclarationBase {
  /** Body scanned for hoisted `var` declarations when present. */
  body?: ts.Node
}

const functionScopeOf = (node: FunctionLikeNode): Set<string> => {
  const scope = createSet<string>([])
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) scope.add(node.name.text)
  for (const parameter of node.parameters) bindingIdentifiers(parameter.name, scope)
  if (!ts.isArrowFunction(node)) scope.add('arguments')
  if (node.body) collectHoistedVars(node.body, scope)
  return scope
}

const forInitializerScopeOf = (initializer: ts.ForInitializer | undefined): Set<string> | null => {
  if (initializer === undefined || !ts.isVariableDeclarationList(initializer) || (initializer.flags & ts.NodeFlags.BlockScoped) === 0)
    return null
  const scope = createSet<string>([])
  for (const decl of initializer.declarations) bindingIdentifiers(decl.name, scope)
  return scope
}

const scopeBindingsOf = (node: ts.Node): Set<string> | null => {
  if (ts.isClassStaticBlockDeclaration(node)) {
    const scope = createSet<string>([])
    collectHoistedVars(node.body, scope)
    return scope
  }
  if (ts.isFunctionLike(node)) return functionScopeOf(node as FunctionLikeNode)
  if (ts.isBlock(node)) {
    const scope = createSet<string>([])
    lexicalNamesOf(node.statements, scope)
    return scope
  }
  if (ts.isCaseBlock(node)) {
    const scope = createSet<string>([])
    for (const clause of node.clauses) lexicalNamesOf(clause.statements, scope)
    return scope
  }
  if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) return forInitializerScopeOf(node.initializer)
  if (ts.isCatchClause(node) && node.variableDeclaration) {
    const scope = createSet<string>([])
    bindingIdentifiers(node.variableDeclaration.name, scope)
    return scope
  }
  if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) return createSet<string>([node.name.text])
  return null
}

const isDeclarationName = (parent: ts.Node, id: ts.Identifier): boolean =>
  (ts.isVariableDeclaration(parent) && parent.name === id) ||
  (ts.isParameter(parent) && parent.name === id) ||
  (ts.isBindingElement(parent) && parent.name === id) ||
  ((ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) &&
    parent.name === id) ||
  ((ts.isMethodDeclaration(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent)) &&
    parent.name === id)

const isReferenceIdentifier = (id: ts.Identifier): boolean => {
  const parent = id.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false
  if (ts.isBindingElement(parent) && parent.propertyName === id) return false
  if (isDeclarationName(parent, id)) return false
  if (ts.isLabeledStatement(parent) && parent.label === id) return false
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === id) return false
  if (ts.isMetaProperty(parent)) return false
  return true
}

/**
 * Collects the free identifier references of a top-level statement: names that
 * are read inside it but bound by no scope the statement itself introduces.
 *
 * Unlike the prune pass's over-approximating `collectRefs` (which counts every
 * identifier, parameters and locals included), this walk tracks the lexical
 * environment — function parameters, `var` hoisting, block-scoped `let` /
 * `const` / `class` / `function`, `for` initializers, catch parameters, class
 * names, and the implicit `arguments` — so a name shadowed inside the statement
 * is never reported. Only genuinely free names may become import edges, which
 * is what keeps the dedupe pass from fabricating cross-module imports out of
 * parameter names.
 *
 * @param statement - The top-level statement to analyze.
 * @param sink - Receives each free identifier text.
 *
 * @example Parameters are not free references
 * ```typescript
 * collectFreeRefs(fnDecl, refs) // `function f(data) { return data + g }` adds only 'g'
 * ```
 */
export const collectFreeRefs = (statement: ts.Statement, sink: Set<string>): void => {
  const scopes: Array<Set<string>> = []
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      if (isReferenceIdentifier(node) && !scopes.some((scope) => scope.has(node.text))) sink.add(node.text)
      return
    }
    const scope = scopeBindingsOf(node)
    if (scope) scopes.push(scope)
    ts.forEachChild(node, visit)
    if (scope) scopes.pop()
  }
  visit(statement)
}
