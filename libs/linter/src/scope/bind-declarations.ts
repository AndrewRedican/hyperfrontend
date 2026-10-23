/**
 * The binder's handling of the constructs that declare names or open scopes of their own:
 * functions, classes, imports and exports, enums and namespaces, and the JSX elements that
 * reference components and the pragma.
 *
 * @module scope/bind-declarations
 */

import type { Node } from '../code/model'
import type { Binder } from './binder'
import { definition, referenceValue } from './binder'

/**
 * Binds a declaring construct.
 *
 * @param binder - The walk in progress
 * @param node - The construct
 *
 * @example Imports, classes and enums each declare their name
 * ```ts
 * const text = 'import { load } from "./api"\nclass Store {}\nenum Level { Low }'
 * const program = parseCode(text, '.ts').tree
 * const analysis = analyzeScopes(program, DEFAULT_LANGUAGE)
 * const [load] = analysis.declaredVariables(program.body[0])
 * load.defs[0].kind // => 'ImportBinding'
 * analysis.scopes.map((scope) => scope.kind)
 * // => ['global', 'module', 'class', 'tsEnum']
 * ```
 */
export function bindDeclaration(binder: Binder, node: Node): void {
  switch (node.kind) {
    case 'ArrowFunctionExpression':
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'TSDeclareFunction':
    case 'TSEmptyBodyFunctionExpression':
      bindFunction(binder, node, false)
      break
    case 'ClassDeclaration':
    case 'ClassExpression':
      bindClass(binder, node)
      break
    case 'ImportDeclaration':
      for (const specifier of node.specifiers as readonly Node[])
        binder.define(binder.scope, specifier.local as Node, 'ImportBinding', specifier, node)
      break
    case 'ExportDefaultDeclaration':
      if ((node.declaration as Node).kind === 'Identifier') binder.manager.reference(node.declaration as Node, 'read', 'both')
      else binder.visit(node.declaration)
      break
    case 'ExportNamedDeclaration':
      bindNamedExport(binder, node)
      break
    case 'TSExportAssignment':
      if ((node.expression as Node).kind === 'Identifier') binder.manager.reference(node.expression as Node, 'read', 'both')
      else binder.visit(node.expression as Node)
      break
    case 'TSImportEqualsDeclaration':
      binder.define(binder.scope, node.id as Node, 'ImportBinding', node, node)
      binder.visit(leftmost(node.moduleReference as Node))
      break
    case 'TSEnumDeclaration':
      bindEnum(binder, node)
      break
    case 'TSModuleDeclaration':
      if ((node.id as Node).kind === 'Identifier' && node.moduleKind !== 'global')
        binder.define(binder.scope, node.id as Node, 'TSModuleName', node)
      binder.manager.nest('tsModule', node)
      binder.visit(node.body as Node | undefined)
      binder.manager.close(node)
      break
    default:
      bindJsx(binder, node)
  }
}

/**
 * Binds a function: its name where the construct puts it, its own scope, its parameters with
 * their defaults and types, its body without a block scope of its own. Only a method's
 * parameters carry decorators, visited before its scope opens.
 *
 * @param binder - The walk in progress
 * @param node - The function bound
 * @param isMethod - Whether it is a class method
 *
 * @example A named function expression's name gets a scope of its own
 * ```ts
 * const text = 'const run = function step() { return step }'
 * const program = parseCode(text, '.ts').tree
 * const analysis = analyzeScopes(program, DEFAULT_LANGUAGE)
 * const expression = program.body[0].declarations[0].init
 * analysis.scopesOf(expression).map((scope) => scope.kind)
 * // => ['function-expression-name', 'function']
 * findVariable(analysis.global, 'step') // => null, not visible outside
 * ```
 */
export function bindFunction(binder: Binder, node: Node, isMethod: boolean): void {
  if (node.kind === 'FunctionExpression') {
    if (node.id !== null && node.id !== undefined) {
      const named = binder.manager.nest('function-expression-name', node)
      binder.define(named, node.id, 'FunctionName', node)
    }
  } else if (node.kind !== 'ArrowFunctionExpression' && node.id !== null && node.id !== undefined) {
    binder.define(binder.scope, node.id, 'FunctionName', node)
  }
  const params = node.params as readonly Node[]
  if (isMethod) for (const param of params) for (const decorator of decoratorsOf(param)) binder.visit(decorator)
  binder.manager.nest('function', node, isMethod)
  for (const param of params) {
    binder.visitPattern(
      param,
      (pattern, info) => {
        binder.define(binder.scope, pattern, 'Parameter', node, null, info.rest)
        binder.referenceDefaults(pattern, info.assignments, true)
      },
      true
    )
    bindParameterType(binder, param)
  }
  binder.visitType(node.returnType)
  binder.visitType(node.typeParameters)
  const body = node.body as Node | null | undefined
  if (body !== null && body !== undefined) {
    // why: the body's block creates no block scope of its own.
    if (body.kind === 'BlockStatement') binder.visitChildren(body)
    else binder.visit(body)
  }
  binder.manager.close(node)
}

/**
 * Visits a parameter's type annotation, under the default or the parameter property.
 *
 * @param binder - The walk in progress
 * @param param - The parameter whose annotation is visited
 */
function bindParameterType(binder: Binder, param: Node): void {
  if (param.kind === 'AssignmentPattern') binder.visitType((param.left as Node).typeAnnotation)
  else if (param.kind === 'TSParameterProperty') bindParameterType(binder, param.parameter as Node)
  else binder.visitType(param.typeAnnotation)
}

/**
 * Binds a class: its name outside and inside, its decorators, heritage, members, field
 * initialisers and static blocks in their own scopes.
 *
 * @param binder - The walk in progress
 * @param node - The class bound
 */
function bindClass(binder: Binder, node: Node): void {
  const id = node.id as Node | null | undefined
  if (node.kind === 'ClassDeclaration' && id !== null && id !== undefined) binder.define(binder.scope, id, 'ClassName', node)
  for (const decorator of node.decorators as readonly Node[]) binder.visit(decorator)
  const scope = binder.manager.nest('class', node)
  if (id !== null && id !== undefined) binder.define(scope, id, 'ClassName', node)
  binder.visit(node.superClass)
  binder.visitType(node.typeParameters)
  binder.visitType(node.superTypeArguments)
  for (const implemented of node.implements as readonly Node[]) binder.visitType(implemented)
  for (const member of (node.body as Node).body as readonly Node[]) bindMember(binder, member)
  binder.manager.close(node)
}

/**
 * Binds one class member.
 *
 * @param binder - The walk in progress
 * @param member - The member bound
 */
function bindMember(binder: Binder, member: Node): void {
  switch (member.kind) {
    case 'MethodDefinition':
      if (member.computed === true) binder.visit(member.key)
      if ((member.value as Node).kind === 'FunctionExpression') bindFunction(binder, member.value as Node, true)
      else binder.visit(member.value as Node)
      for (const decorator of member.decorators as readonly Node[]) binder.visit(decorator)
      break
    case 'StaticBlock':
      binder.manager.nest('class-static-block', member)
      for (const statement of member.body as readonly Node[]) binder.visit(statement)
      binder.manager.close(member)
      break
    case 'TSIndexSignature':
      binder.visitType(member)
      break
    default:
      bindProperty(binder, member)
  }
}

/**
 * Binds a property, accessor or abstract member: its computed key, its value in an initialiser
 * scope, its decorators, its type.
 *
 * @param binder - The walk in progress
 * @param member - The member bound
 */
function bindProperty(binder: Binder, member: Node): void {
  if (member.computed === true) binder.visit(member.key)
  const value = member.value as Node | null | undefined
  if (value !== null && value !== undefined) {
    const initialiser = member.kind === 'PropertyDefinition' || member.kind === 'AccessorProperty'
    if (initialiser) binder.manager.nest('class-field-initializer', value)
    binder.visit(value)
    if (initialiser) binder.manager.close(value)
  }
  for (const decorator of member.decorators as readonly Node[]) binder.visit(decorator)
  if (member.kind !== 'TSAbstractMethodDefinition') binder.visitType(member.typeAnnotation)
}

/**
 * Binds a named export: its declaration, or the names it re-exports from the scope as reads in
 * the positions its kind allows.
 *
 * @param binder - The walk in progress
 * @param node - The export statement
 */
function bindNamedExport(binder: Binder, node: Node): void {
  if (node.declaration !== null && node.declaration !== undefined) {
    binder.visit(node.declaration)
    return
  }
  if (node.source !== null) return
  for (const specifier of node.specifiers as readonly Node[]) {
    binder.manager.reference(
      specifier.local as Node,
      'read',
      specifier.exportKind === 'type' || node.exportKind === 'type' ? 'type' : 'both'
    )
  }
}

/**
 * Binds an enum: its name, its own scope with each member declared, their initialisers.
 *
 * @param binder - The walk in progress
 * @param node - The enum declaration
 */
function bindEnum(binder: Binder, node: Node): void {
  binder.define(binder.scope, node.id as Node, 'TSEnumName', node)
  const scope = binder.manager.nest('tsEnum', node)
  for (const member of (node.body as Node).members as readonly Node[]) {
    const id = member.id as Node
    // why: the parser admits only identifiers and string literals as member names.
    if (id.kind === 'Literal')
      binder.manager.define(scope, id.value as string, null, definition('TSEnumMemberName', id, member, null, false))
    else binder.define(scope, id, 'TSEnumMemberName', member)
    binder.visit(member.init)
  }
  binder.manager.close(node)
}

/**
 * Binds a JSX construct: the pragma and fragment factory on elements and fragments, component
 * names as values, attribute values and children.
 *
 * @param binder - The walk in progress
 * @param node - The construct
 */
function bindJsx(binder: Binder, node: Node): void {
  switch (node.kind) {
    case 'JSXAttribute':
      binder.visit(node.value as Node | null)
      break
    case 'JSXClosingElement':
      bindElementName(binder, node.name as Node)
      break
    case 'JSXFragment':
      binder.referencePragma()
      binder.referenceFragment()
      binder.visitChildren(node)
      break
    case 'JSXIdentifier':
      referenceValue(binder, node)
      break
    case 'JSXMemberExpression': {
      const object = node.object as Node
      if (object.kind !== 'JSXIdentifier' || object.name !== 'this') binder.visit(object)
      break
    }
    default:
      binder.referencePragma()
      bindElementName(binder, node.name as Node)
      binder.visitType(node.typeArguments)
      for (const attribute of node.attributes as readonly Node[]) binder.visit(attribute)
  }
}

/**
 * References an element's name when it names a component rather than an intrinsic element.
 *
 * @param binder - The walk in progress
 * @param name - The name as written in the tag
 */
function bindElementName(binder: Binder, name: Node): void {
  if (name.kind !== 'JSXIdentifier') {
    binder.visit(name)
    return
  }
  const text = name.name as string
  if (text[0]?.toUpperCase() === text[0] || text === 'this') binder.visit(name)
}

/**
 * The leftmost name of a qualified name, or the node itself.
 *
 * @param node - A qualified name or any other node
 * @returns The leftmost name
 *
 * @example Find the root of a qualified type name
 * ```ts
 * // typeName: the TSQualifiedName of 'let user: Models.User'
 * leftmost(typeName).name // => 'Models'
 * ```
 */
export function leftmost(node: Node): Node {
  let current = node
  while (current.kind === 'TSQualifiedName') current = current.left as Node
  return current
}

/**
 * A method parameter's decorators; a parameter the parser gave none has no array for them.
 *
 * @param param - The parameter
 * @returns Its decorators, in source order
 */
function decoratorsOf(param: Node): readonly Node[] {
  return param.decorators ?? []
}
