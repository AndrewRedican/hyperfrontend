/**
 * The names one declaration refers to, with where each stands, and the constructs the extraction
 * rewrites rather than carries: `typeof`, import types, `any`, and members or parameters left
 * untyped.
 *
 * @module types-extract/references
 */

import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Where a reference stands in its declaration. */
export type Position =
  | 'property'
  | 'parameter'
  | 'return'
  | 'type-argument'
  | 'heritage'
  | 'generic-constraint'
  | 'generic-default'
  | 'index-signature'
  | 'alias'
  | 'other'

/** One reference to a named type. */
export interface TypeReference {
  /** The last segment of the name as written. */
  readonly name: string
  /** The first segment of a qualified name, or null for a plain one. */
  readonly qualifier: string | null
  /** Whether the name has more than two segments. */
  readonly deep: boolean
  /** The reference node: the type reference or the heritage expression. */
  readonly node: ts.Node
  /** The name within it. */
  readonly nameNode: ts.Node
  /** Where it stands. */
  readonly position: Position
}

/** A construct rewritten in the emitted declaration. */
export interface Oddity {
  /** Which construct. */
  readonly kind: 'typeof' | 'import-type' | 'any' | 'untyped-parameter' | 'untyped-member'
  /** The node, replaced whole for `typeof`, import types and `any`. */
  readonly node: ts.Node
  /** Where it stands. */
  readonly position: Position
  /** For an untyped parameter or member, where the annotation is inserted. */
  readonly insertAt?: number
  /** For an untyped parameter or member, the annotation inserted. */
  readonly insertText?: string
}

/** What a declaration refers to and what in it is rewritten. */
export interface References {
  /** The named types referred to, in source order. */
  readonly references: readonly TypeReference[]
  /** The constructs rewritten, in source order. */
  readonly oddities: readonly Oddity[]
}

/** A node that may declare type parameters. */
interface WithTypeParameters {
  /** The type parameters, when declared. */
  readonly typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>
}

/**
 * Whether a node is a signature whose `type` is its return type.
 *
 * @param node - The node examined
 * @returns True for method, call, construct and function signatures, functions, methods and accessors
 */
function isSignatureLike(node: ts.Node): node is ts.SignatureDeclarationBase {
  return (
    ts.isMethodSignature(node) ||
    ts.isCallSignatureDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node) ||
    ts.isFunctionTypeNode(node) ||
    ts.isConstructorTypeNode(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isArrowFunction(node)
  )
}

/**
 * Where a node stands in its declaration.
 *
 * @param node - A reference or rewritten node
 * @param root - The declaration being walked
 * @returns Where the node stands: property, parameter, return and so on
 */
export function positionOf(node: ts.Node, root: ts.Node): Position {
  let child: ts.Node = node
  let parent: ts.Node | undefined = node.parent
  while (parent !== undefined && child !== root) {
    if (ts.isParameter(parent)) return 'parameter'
    if (ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent)) return 'property'
    if (ts.isIndexSignatureDeclaration(parent)) return 'index-signature'
    if (ts.isTypeParameterDeclaration(parent)) return parent.constraint === child ? 'generic-constraint' : 'generic-default'
    if (ts.isHeritageClause(parent)) return 'heritage'
    if (ts.isTypeReferenceNode(parent) || ts.isExpressionWithTypeArguments(parent)) return 'type-argument'
    if (isSignatureLike(parent) && parent.type === child) return 'return'
    if (ts.isTypeAliasDeclaration(parent)) return 'alias'
    child = parent
    parent = parent.parent
  }
  return 'other'
}

/**
 * The segments of an entity name or property access, left to right.
 *
 * @param name - The name expression
 * @returns The identifier texts, or null when a segment is not an identifier
 */
function segmentsOf(name: ts.Node): string[] | null {
  if (ts.isIdentifier(name)) return [name.text]
  // note: the left of a qualified name is itself an identifier or a qualified name, so it always has segments.
  if (ts.isQualifiedName(name)) return [...(segmentsOf(name.left) as string[]), name.right.text]
  if (ts.isPropertyAccessExpression(name) && ts.isIdentifier(name.name)) {
    const left = segmentsOf(name.expression)
    return left === null ? null : [...left, name.name.text]
  }
  return null
}

/**
 * The `infer` names a conditional type declares in its `extends` clause.
 *
 * @param node - The extends type
 * @returns The inferred type parameter names
 */
function inferNames(node: ts.Node): string[] {
  const names: string[] = []
  const visit = (child: ts.Node): void => {
    if (ts.isInferTypeNode(child)) names.push(child.typeParameter.name.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

/**
 * The offset just past a signature's closing parenthesis, where a missing return type goes.
 *
 * @param node - A method signature without a return type
 * @param sourceFile - Its file
 * @returns The offset
 */
function afterParameters(node: ts.MethodSignature, sourceFile: ts.SourceFile): number {
  return sourceFile.text.indexOf(')', node.parameters.end) + 1
}

/**
 * Collects what a declaration refers to and what in it must be rewritten. Type parameters in
 * scope are not references; a `typeof`, an import type or an `any` is not descended into.
 *
 * @param root - The declaration
 * @param sourceFile - Its file
 * @returns The references and the rewritten constructs
 */
export function collectReferences(root: ts.Node, sourceFile: ts.SourceFile): References {
  const references: TypeReference[] = []
  const oddities: Oddity[] = []
  const inScope = (scope: readonly Set<string>[], name: string): boolean => scope.some((names) => names.has(name))
  const reference = (node: ts.Node, nameNode: ts.Node, scope: readonly Set<string>[]): void => {
    const segments = segmentsOf(nameNode)
    if (segments === null) return
    const head = segments[0] as string
    if (inScope(scope, head)) return
    const name = segments[segments.length - 1] as string
    references.push({
      name,
      qualifier: segments.length > 1 ? head : null,
      deep: segments.length > 2,
      node,
      nameNode,
      position: positionOf(node, root),
    })
  }
  const visit = (node: ts.Node, scope: readonly Set<string>[]): void => {
    if (ts.isTypeQueryNode(node)) return void oddities.push({ kind: 'typeof', node, position: positionOf(node, root) })
    if (ts.isImportTypeNode(node)) return void oddities.push({ kind: 'import-type', node, position: positionOf(node, root) })
    if (node.kind === ts.SyntaxKind.AnyKeyword) return void oddities.push({ kind: 'any', node, position: positionOf(node, root) })
    if (ts.isParameter(node) && node.type === undefined) {
      const insertAt = (node.questionToken ?? node.name).end
      oddities.push({
        kind: 'untyped-parameter',
        node,
        position: 'parameter',
        insertAt,
        insertText: node.dotDotDotToken === undefined ? ': unknown' : ': unknown[]',
      })
    }
    if (ts.isPropertySignature(node) && node.type === undefined) {
      oddities.push({
        kind: 'untyped-member',
        node,
        position: 'property',
        insertAt: (node.questionToken ?? node.name).end,
        insertText: ': unknown',
      })
    }
    if (ts.isMethodSignature(node) && node.type === undefined) {
      oddities.push({
        kind: 'untyped-member',
        node,
        position: 'return',
        insertAt: afterParameters(node, sourceFile),
        insertText: ': unknown',
      })
    }
    if (ts.isTypeReferenceNode(node) || (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent))) {
      reference(node, ts.isTypeReferenceNode(node) ? node.typeName : node.expression, scope)
      for (const argument of node.typeArguments ?? []) visit(argument, scope)
      return
    }
    const declared = createSet<string>()
    for (const parameter of (node as WithTypeParameters).typeParameters ?? []) declared.add(parameter.name.text)
    if (ts.isMappedTypeNode(node)) declared.add(node.typeParameter.name.text)
    if (ts.isConditionalTypeNode(node)) for (const name of inferNames(node.extendsType)) declared.add(name)
    const inner = declared.size === 0 ? scope : [...scope, declared]
    ts.forEachChild(node, (child) => visit(child, inner))
  }
  visit(root, [])
  return { references, oddities }
}
