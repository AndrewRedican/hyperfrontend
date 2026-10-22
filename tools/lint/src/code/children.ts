/**
 * The fields that hold a node's children, per kind, in source order. Traversal, scope binding and
 * every service walk the tree through this table and never guess at fields.
 *
 * @module code/children
 */

import type { Kind, Node } from './model.ts'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/** The fields holding each kind's children, in source order. */
export const CHILD_FIELDS: Readonly<Record<Kind, readonly (keyof Node)[]>> = {
  Program: ['body'],
  ExpressionStatement: ['expression'],
  BlockStatement: ['body'],
  EmptyStatement: [],
  DebuggerStatement: [],
  WithStatement: ['object', 'body'],
  ReturnStatement: ['argument'],
  LabeledStatement: ['label', 'body'],
  BreakStatement: ['label'],
  ContinueStatement: ['label'],
  IfStatement: ['test', 'consequent', 'alternate'],
  SwitchStatement: ['discriminant', 'cases'],
  SwitchCase: ['test', 'consequent'],
  ThrowStatement: ['argument'],
  TryStatement: ['block', 'handler', 'finalizer'],
  CatchClause: ['param', 'body'],
  WhileStatement: ['test', 'body'],
  DoWhileStatement: ['body', 'test'],
  ForStatement: ['init', 'test', 'update', 'body'],
  ForInStatement: ['left', 'right', 'body'],
  ForOfStatement: ['left', 'right', 'body'],
  FunctionDeclaration: ['id', 'typeParameters', 'params', 'returnType', 'body'],
  TSDeclareFunction: ['id', 'typeParameters', 'params', 'returnType'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id', 'init'],
  ClassDeclaration: ['decorators', 'id', 'typeParameters', 'superClass', 'superTypeArguments', 'implements', 'body'],
  ClassExpression: ['decorators', 'id', 'typeParameters', 'superClass', 'superTypeArguments', 'implements', 'body'],
  ClassBody: ['body'],
  MethodDefinition: ['decorators', 'key', 'value'],
  PropertyDefinition: ['decorators', 'key', 'typeAnnotation', 'value'],
  TSAbstractMethodDefinition: ['decorators', 'key', 'value'],
  TSAbstractPropertyDefinition: ['decorators', 'key', 'typeAnnotation', 'value'],
  AccessorProperty: ['decorators', 'key', 'typeAnnotation', 'value'],
  StaticBlock: ['body'],
  TSIndexSignature: ['parameters', 'typeAnnotation'],
  Decorator: ['expression'],
  ImportDeclaration: ['specifiers', 'source', 'attributes'],
  ImportSpecifier: ['imported', 'local'],
  ImportDefaultSpecifier: ['local'],
  ImportNamespaceSpecifier: ['local'],
  ImportAttribute: ['key', 'value'],
  ExportNamedDeclaration: ['declaration', 'specifiers', 'source', 'attributes'],
  ExportSpecifier: ['local', 'exported'],
  ExportDefaultDeclaration: ['declaration'],
  ExportAllDeclaration: ['exported', 'source', 'attributes'],
  TSExportAssignment: ['expression'],
  TSImportEqualsDeclaration: ['id', 'moduleReference'],
  TSExternalModuleReference: ['expression'],
  TSNamespaceExportDeclaration: ['id'],
  Identifier: ['decorators', 'typeAnnotation'],
  PrivateIdentifier: [],
  Literal: [],
  TemplateLiteral: ['quasis', 'expressions'],
  TemplateElement: [],
  TaggedTemplateExpression: ['tag', 'typeArguments', 'quasi'],
  ThisExpression: [],
  Super: [],
  ArrayExpression: ['elements'],
  ObjectExpression: ['properties'],
  Property: ['key', 'value'],
  FunctionExpression: ['id', 'typeParameters', 'params', 'returnType', 'body'],
  TSEmptyBodyFunctionExpression: ['id', 'typeParameters', 'params', 'returnType'],
  ArrowFunctionExpression: ['typeParameters', 'params', 'returnType', 'body'],
  UnaryExpression: ['argument'],
  UpdateExpression: ['argument'],
  BinaryExpression: ['left', 'right'],
  LogicalExpression: ['left', 'right'],
  AssignmentExpression: ['left', 'right'],
  ConditionalExpression: ['test', 'consequent', 'alternate'],
  CallExpression: ['callee', 'typeArguments', 'arguments'],
  NewExpression: ['callee', 'typeArguments', 'arguments'],
  MemberExpression: ['object', 'property'],
  ChainExpression: ['expression'],
  SequenceExpression: ['expressions'],
  YieldExpression: ['argument'],
  AwaitExpression: ['argument'],
  ImportExpression: ['source', 'options'],
  MetaProperty: ['meta', 'property'],
  SpreadElement: ['argument'],
  ArrayPattern: ['decorators', 'elements', 'typeAnnotation'],
  ObjectPattern: ['decorators', 'properties', 'typeAnnotation'],
  RestElement: ['decorators', 'argument', 'typeAnnotation'],
  AssignmentPattern: ['decorators', 'left', 'right'],
  TSAsExpression: ['expression', 'typeAnnotation'],
  TSSatisfiesExpression: ['expression', 'typeAnnotation'],
  TSNonNullExpression: ['expression'],
  TSTypeAssertion: ['typeAnnotation', 'expression'],
  TSInstantiationExpression: ['expression', 'typeArguments'],
  TSParameterProperty: ['decorators', 'parameter'],
  JSXElement: ['openingElement', 'children', 'closingElement'],
  JSXFragment: ['openingFragment', 'children', 'closingFragment'],
  JSXOpeningElement: ['name', 'typeArguments', 'attributes'],
  JSXClosingElement: ['name'],
  JSXOpeningFragment: [],
  JSXClosingFragment: [],
  JSXAttribute: ['name', 'value'],
  JSXSpreadAttribute: ['argument'],
  JSXIdentifier: [],
  JSXNamespacedName: ['namespace', 'name'],
  JSXMemberExpression: ['object', 'property'],
  JSXText: [],
  JSXExpressionContainer: ['expression'],
  JSXEmptyExpression: [],
  JSXSpreadChild: ['expression'],
  TSTypeAnnotation: ['typeAnnotation'],
  TSTypeParameterDeclaration: ['params'],
  TSTypeParameter: ['name', 'constraint', 'default'],
  TSTypeParameterInstantiation: ['params'],
  TSInterfaceDeclaration: ['id', 'typeParameters', 'extends', 'body'],
  TSInterfaceBody: ['body'],
  TSInterfaceHeritage: ['expression', 'typeArguments'],
  TSClassImplements: ['expression', 'typeArguments'],
  TSTypeAliasDeclaration: ['id', 'typeParameters', 'typeAnnotation'],
  TSEnumDeclaration: ['id', 'body'],
  TSEnumBody: ['members'],
  TSEnumMember: ['id', 'init'],
  TSModuleDeclaration: ['id', 'body'],
  TSModuleBlock: ['body'],
  TSPropertySignature: ['key', 'typeAnnotation'],
  TSMethodSignature: ['key', 'typeParameters', 'params', 'returnType'],
  TSCallSignatureDeclaration: ['typeParameters', 'params', 'returnType'],
  TSConstructSignatureDeclaration: ['typeParameters', 'params', 'returnType'],
  TSTypeLiteral: ['members'],
  TSTypeReference: ['typeName', 'typeArguments'],
  TSQualifiedName: ['left', 'right'],
  TSUnionType: ['types'],
  TSIntersectionType: ['types'],
  TSArrayType: ['elementType'],
  TSTupleType: ['elementTypes'],
  TSNamedTupleMember: ['label', 'elementType'],
  TSOptionalType: ['typeAnnotation'],
  TSRestType: ['typeAnnotation'],
  TSFunctionType: ['typeParameters', 'params', 'returnType'],
  TSConstructorType: ['typeParameters', 'params', 'returnType'],
  TSConditionalType: ['checkType', 'extendsType', 'trueType', 'falseType'],
  TSInferType: ['typeParameter'],
  TSMappedType: ['key', 'constraint', 'nameType', 'typeAnnotation'],
  TSIndexedAccessType: ['objectType', 'indexType'],
  TSTypeOperator: ['typeAnnotation'],
  TSTypeQuery: ['exprName', 'typeArguments'],
  TSImportType: ['argument', 'qualifier', 'typeArguments'],
  TSLiteralType: ['literal'],
  TSTemplateLiteralType: ['quasis', 'types'],
  TSTypePredicate: ['parameterName', 'typeAnnotation'],
  TSThisType: [],
  TSAnyKeyword: [],
  TSUnknownKeyword: [],
  TSNeverKeyword: [],
  TSVoidKeyword: [],
  TSUndefinedKeyword: [],
  TSNullKeyword: [],
  TSStringKeyword: [],
  TSNumberKeyword: [],
  TSBooleanKeyword: [],
  TSBigIntKeyword: [],
  TSSymbolKeyword: [],
  TSObjectKeyword: [],
  TSIntrinsicKeyword: [],
}

/**
 * Whether a value is a node.
 *
 * @param value - Any field value
 * @returns True for an object with a kind
 */
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'kind' in value && typeof (value as Node).kind === 'string'
}

/**
 * The children of a node, in source order.
 *
 * @param node - Any node
 * @returns The child nodes
 */
export function childrenOf(node: Node): Node[] {
  const children: Node[] = []
  for (const field of CHILD_FIELDS[node.kind]) {
    const value = node[field] as unknown
    if (isNode(value)) children.push(value)
    else if (isArray(value)) for (const item of value as unknown[]) if (isNode(item)) children.push(item)
  }
  return children
}

/**
 * Sets the parent of every node under a root.
 *
 * @param root - The program
 */
export function setParents(root: Node): void {
  const visit = (node: Node): void => {
    for (const child of childrenOf(node)) {
      child.parent = node
      visit(child)
    }
  }
  root.parent = null
  visit(root)
}
