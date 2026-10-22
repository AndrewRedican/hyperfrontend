/**
 * The binder's handling of type positions: names referenced as types, the scopes type
 * parameters, mapped types, conditional types and function types open, and the few places
 * inside a type that stand in value positions.
 *
 * @module scope/bind-types
 */

import type { Node } from '../code/model.ts'
import type { Binder } from './binder.ts'
import type { Scope } from './model.ts'
import { CHILD_FIELDS } from '../code/children.ts'
import { leftmost } from './bind-declarations.ts'

/**
 * Visits a node in a type position.
 *
 * @param binder - The walk in progress
 * @param node - The node standing in a type position
 */
export function visitTypeNode(binder: Binder, node: Node): void {
  switch (node.kind) {
    case 'Identifier':
      binder.manager.reference(node, 'read', 'type')
      break
    case 'MemberExpression':
      visitTypeNode(binder, node.object as Node)
      break
    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration':
    case 'TSConstructorType':
    case 'TSFunctionType':
      visitFunctionType(binder, node)
      break
    case 'TSMethodSignature':
      if (node.computed === true) binder.visit(node.key)
      visitFunctionType(binder, node)
      break
    case 'TSPropertySignature':
      if (node.computed === true) binder.visit(node.key)
      binder.visitType(node.typeAnnotation)
      break
    case 'TSConditionalType':
      binder.manager.nest('conditionalType', node)
      binder.visitType(node.checkType)
      binder.visitType(node.extendsType)
      binder.visitType(node.trueType)
      binder.manager.close(node)
      binder.visitType(node.falseType)
      break
    case 'TSImportType':
      binder.visitType(node.typeArguments)
      break
    case 'TSIndexSignature':
      for (const parameter of node.parameters as readonly Node[]) binder.visitType(parameter.typeAnnotation)
      binder.visitType(node.typeAnnotation)
      break
    case 'TSInferType':
      visitInfer(binder, node)
      break
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
      visitTypeDeclaration(binder, node)
      break
    case 'TSMappedType':
      binder.manager.nest('mappedType', node)
      binder.define(binder.scope, node.key as Node, 'Type', node)
      binder.visitType(node.constraint)
      binder.visitType(node.nameType)
      binder.visitType(node.typeAnnotation)
      binder.manager.close(node)
      break
    case 'TSNamedTupleMember':
      binder.visitType(node.elementType)
      break
    case 'TSQualifiedName':
      binder.visitType(node.left)
      break
    case 'TSTypeParameter':
      binder.define(binder.scope, node.name as Node, 'Type', node)
      binder.visitType(node.constraint)
      binder.visitType(node.default)
      break
    case 'TSTypePredicate':
      if ((node.parameterName as Node).kind !== 'TSThisType') binder.manager.reference(node.parameterName as Node, 'read', 'value')
      binder.visitType(node.typeAnnotation)
      break
    case 'TSTypeQuery':
      visitTypeQuery(binder, node)
      break
    default:
      visitTypeChildren(binder, node)
  }
}

/**
 * Visits a node's children in type positions.
 *
 * @param binder - The walk in progress
 * @param node - The node whose children are visited
 */
function visitTypeChildren(binder: Binder, node: Node): void {
  for (const field of CHILD_FIELDS[node.kind]) {
    const value = node[field] as Node | readonly (Node | null)[] | null | undefined
    if (value === null || value === undefined) continue
    if ('kind' in value) visitTypeNode(binder, value)
    else for (const child of value) if (child !== null) visitTypeNode(binder, child)
  }
}

/**
 * Binds a function type or signature: its own scope, its type parameters, its parameters with
 * their types, its return type.
 *
 * @param binder - The walk in progress
 * @param node - The function type or signature
 */
function visitFunctionType(binder: Binder, node: Node): void {
  binder.manager.nest('functionType', node)
  binder.visitType(node.typeParameters)
  for (const param of node.params as readonly Node[]) {
    let visitedAnnotation = false
    binder.visitPattern(param, (pattern, info) => {
      binder.define(binder.scope, pattern, 'Parameter', node, null, info.rest)
      if (pattern.typeAnnotation !== undefined) {
        binder.visitType(pattern.typeAnnotation)
        visitedAnnotation = true
      }
    })
    // why: a destructured or rest parameter owns its annotation, not the identifiers it binds.
    if (!visitedAnnotation) binder.visitType(param.typeAnnotation)
  }
  binder.visitType(node.returnType)
  binder.manager.close(node)
}

/**
 * Declares an inferred type parameter in the conditional type that owns it, looking out past
 * the function and mapped types between.
 *
 * @param binder - The walk in progress
 * @param node - The inference
 */
function visitInfer(binder: Binder, node: Node): void {
  const typeParameter = node.typeParameter as Node
  let scope: Scope = binder.scope
  if (scope.kind === 'functionType' || scope.kind === 'mappedType') {
    for (let candidate = scope.upper; candidate !== null; candidate = candidate.upper) {
      if (candidate.kind === 'functionType' || candidate.kind === 'mappedType') continue
      if (candidate.kind === 'conditionalType') scope = candidate
      break
    }
  }
  binder.define(scope, typeParameter.name as Node, 'Type', typeParameter)
  binder.visitType(typeParameter.constraint)
}

/**
 * Binds an interface or type alias: its name in the current scope, a scope of its own when it
 * has type parameters, its heritage and body or its type.
 *
 * @param binder - The walk in progress
 * @param node - The interface or alias declaration
 */
function visitTypeDeclaration(binder: Binder, node: Node): void {
  binder.define(binder.scope, node.id as Node, 'Type', node)
  const typeParameters = node.typeParameters
  if (typeParameters !== undefined) {
    binder.manager.nest('type', node)
    binder.visitType(typeParameters)
  }
  if (node.kind === 'TSInterfaceDeclaration') {
    for (const heritage of node.extends as readonly Node[]) binder.visitType(heritage)
    binder.visitType(node.body as Node)
  } else binder.visitType(node.typeAnnotation)
  if (typeParameters !== undefined) binder.manager.close(node)
}

/**
 * Binds a `typeof` query: a value reference to the leftmost name, its type arguments.
 *
 * @param binder - The walk in progress
 * @param node - The query bound
 */
function visitTypeQuery(binder: Binder, node: Node): void {
  const name = leftmost(node.exprName as Node)
  if (name.kind === 'TSImportType') binder.visitType(name)
  else if (name.kind === 'Identifier') binder.manager.reference(name, 'read', 'value')
  binder.visitType(node.typeArguments)
}
