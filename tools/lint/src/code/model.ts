/**
 * The code tree: node kinds named as the ESTree and TypeScript-ESTree vocabularies name them,
 * one node shape for every kind, each node with its offsets and its parent. A field a kind does
 * not carry is undefined.
 *
 * @module code/model
 */

/** The node kinds. */
export type Kind =
  | 'Program'
  | 'ExpressionStatement'
  | 'BlockStatement'
  | 'EmptyStatement'
  | 'DebuggerStatement'
  | 'WithStatement'
  | 'ReturnStatement'
  | 'LabeledStatement'
  | 'BreakStatement'
  | 'ContinueStatement'
  | 'IfStatement'
  | 'SwitchStatement'
  | 'SwitchCase'
  | 'ThrowStatement'
  | 'TryStatement'
  | 'CatchClause'
  | 'WhileStatement'
  | 'DoWhileStatement'
  | 'ForStatement'
  | 'ForInStatement'
  | 'ForOfStatement'
  | 'FunctionDeclaration'
  | 'TSDeclareFunction'
  | 'VariableDeclaration'
  | 'VariableDeclarator'
  | 'ClassDeclaration'
  | 'ClassExpression'
  | 'ClassBody'
  | 'MethodDefinition'
  | 'PropertyDefinition'
  | 'TSAbstractMethodDefinition'
  | 'TSAbstractPropertyDefinition'
  | 'AccessorProperty'
  | 'StaticBlock'
  | 'TSIndexSignature'
  | 'Decorator'
  | 'ImportDeclaration'
  | 'ImportSpecifier'
  | 'ImportDefaultSpecifier'
  | 'ImportNamespaceSpecifier'
  | 'ImportAttribute'
  | 'ExportNamedDeclaration'
  | 'ExportSpecifier'
  | 'ExportDefaultDeclaration'
  | 'ExportAllDeclaration'
  | 'TSExportAssignment'
  | 'TSImportEqualsDeclaration'
  | 'TSExternalModuleReference'
  | 'TSNamespaceExportDeclaration'
  | 'Identifier'
  | 'PrivateIdentifier'
  | 'Literal'
  | 'TemplateLiteral'
  | 'TemplateElement'
  | 'TaggedTemplateExpression'
  | 'ThisExpression'
  | 'Super'
  | 'ArrayExpression'
  | 'ObjectExpression'
  | 'Property'
  | 'FunctionExpression'
  | 'TSEmptyBodyFunctionExpression'
  | 'ArrowFunctionExpression'
  | 'UnaryExpression'
  | 'UpdateExpression'
  | 'BinaryExpression'
  | 'LogicalExpression'
  | 'AssignmentExpression'
  | 'ConditionalExpression'
  | 'CallExpression'
  | 'NewExpression'
  | 'MemberExpression'
  | 'ChainExpression'
  | 'SequenceExpression'
  | 'YieldExpression'
  | 'AwaitExpression'
  | 'ImportExpression'
  | 'MetaProperty'
  | 'SpreadElement'
  | 'ArrayPattern'
  | 'ObjectPattern'
  | 'RestElement'
  | 'AssignmentPattern'
  | 'TSAsExpression'
  | 'TSSatisfiesExpression'
  | 'TSNonNullExpression'
  | 'TSTypeAssertion'
  | 'TSInstantiationExpression'
  | 'TSParameterProperty'
  | 'JSXElement'
  | 'JSXFragment'
  | 'JSXOpeningElement'
  | 'JSXClosingElement'
  | 'JSXOpeningFragment'
  | 'JSXClosingFragment'
  | 'JSXAttribute'
  | 'JSXSpreadAttribute'
  | 'JSXIdentifier'
  | 'JSXNamespacedName'
  | 'JSXMemberExpression'
  | 'JSXText'
  | 'JSXExpressionContainer'
  | 'JSXEmptyExpression'
  | 'JSXSpreadChild'
  | 'TSTypeAnnotation'
  | 'TSTypeParameterDeclaration'
  | 'TSTypeParameter'
  | 'TSTypeParameterInstantiation'
  | 'TSInterfaceDeclaration'
  | 'TSInterfaceBody'
  | 'TSInterfaceHeritage'
  | 'TSClassImplements'
  | 'TSTypeAliasDeclaration'
  | 'TSEnumDeclaration'
  | 'TSEnumBody'
  | 'TSEnumMember'
  | 'TSModuleDeclaration'
  | 'TSModuleBlock'
  | 'TSPropertySignature'
  | 'TSMethodSignature'
  | 'TSCallSignatureDeclaration'
  | 'TSConstructSignatureDeclaration'
  | 'TSTypeLiteral'
  | 'TSTypeReference'
  | 'TSQualifiedName'
  | 'TSUnionType'
  | 'TSIntersectionType'
  | 'TSArrayType'
  | 'TSTupleType'
  | 'TSNamedTupleMember'
  | 'TSOptionalType'
  | 'TSRestType'
  | 'TSFunctionType'
  | 'TSConstructorType'
  | 'TSConditionalType'
  | 'TSInferType'
  | 'TSMappedType'
  | 'TSIndexedAccessType'
  | 'TSTypeOperator'
  | 'TSTypeQuery'
  | 'TSImportType'
  | 'TSLiteralType'
  | 'TSTemplateLiteralType'
  | 'TSTypePredicate'
  | 'TSThisType'
  | 'TSAnyKeyword'
  | 'TSUnknownKeyword'
  | 'TSNeverKeyword'
  | 'TSVoidKeyword'
  | 'TSUndefinedKeyword'
  | 'TSNullKeyword'
  | 'TSStringKeyword'
  | 'TSNumberKeyword'
  | 'TSBooleanKeyword'
  | 'TSBigIntKeyword'
  | 'TSSymbolKeyword'
  | 'TSObjectKeyword'
  | 'TSIntrinsicKeyword'

/** The value of a regular expression literal. */
/** A token the parser consumed. */
export interface SourceToken {
  /** `word`, `number`, `string`, `template`, `regex`, `jsxtext` or `punct`. */
  readonly category: string
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
}

/** A regular expression literal's value. */
export interface RegexValue {
  /** The pattern between the slashes. */
  readonly pattern: string
  /** The flags after the closing slash. */
  readonly flags: string
}

/** The value of a template element. */
export interface TemplateValue {
  /** The text as written. */
  readonly raw: string
  /** The text with escapes decoded, or null when an escape is invalid. */
  readonly cooked: string | null
}

/** A node of the tree. */
export interface Node {
  /** The kind, which selects listeners. */
  readonly kind: Kind
  /** The offset of the first character. */
  readonly start: number
  /** The offset after the last character. */
  end: number
  /** The node this one sits in, null for the program. */
  parent: Node | null
  /** A program's statements, a block's statements, a class body's members, a function's body, a loop's body, a labelled statement's body, a module block's statements. */
  body?: Node | readonly Node[]
  /** Whether a program is a module or a script. */
  sourceType?: 'module' | 'script'
  /** A program's tokens, in source order. */
  tokens?: readonly SourceToken[]
  /** The expression of an expression statement, a decorator, a spread, an assertion, a chain, a container or an export assignment. */
  expression?: Node | boolean
  /** The directive text of a directive prologue statement. */
  directive?: string
  /** The object of a with statement or a member expression. */
  object?: Node
  /** The argument of a return, throw, spread, rest, unary, update, yield, await or import type. */
  argument?: Node | null
  /** The label of a labelled, break or continue statement, or a named tuple member. */
  label?: Node | null
  /** The test of an if, loop, switch case or conditional expression. */
  test?: Node | null
  /** The consequent of an if or conditional, or a switch case's statements. */
  consequent?: Node | readonly Node[]
  /** The alternate of an if or conditional. */
  alternate?: Node | null
  /** The discriminant of a switch. */
  discriminant?: Node
  /** The cases of a switch. */
  cases?: readonly Node[]
  /** The block of a try. */
  block?: Node
  /** The handler of a try. */
  handler?: Node | null
  /** The finaliser of a try. */
  finalizer?: Node | null
  /** The parameter of a catch clause, null when it binds nothing. */
  param?: Node | null
  /** The initialiser of a for statement, a declarator or an enum member. */
  init?: Node | null
  /** The update of a for statement. */
  update?: Node | null
  /** The left side of a for-in, for-of, binary, logical, assignment, assignment pattern or qualified name. */
  left?: Node
  /** The right side of a for-in, for-of, binary, logical, assignment, assignment pattern or qualified name. */
  right?: Node
  /** Whether a for-of awaits, or a function awaits. */
  await?: boolean
  /** The identifier of a declaration, declarator, enum, module, interface, type alias or import equals. */
  id?: Node | null
  /** The parameters of a function, signature, arrow or type parameter list. */
  params?: readonly Node[]
  /** The parameters of an index signature. */
  parameters?: readonly Node[]
  /** Whether a function is a generator. */
  generator?: boolean
  /** Whether a function is async. */
  async?: boolean
  /** The type parameters of a declaration or function. */
  typeParameters?: Node
  /** The return type of a function or signature. */
  returnType?: Node
  /** Whether a declaration is ambient. */
  declare?: boolean
  /** The declarators of a variable declaration. */
  declarations?: readonly Node[]
  /** Which kind of variable declaration: `var`, `let`, `const`, `using` or `await using`. */
  variableKind?: string
  /** Whether a declarator or property is definitely assigned. */
  definite?: boolean
  /** The superclass of a class. */
  superClass?: Node | null
  /** The type arguments passed to the superclass. */
  superTypeArguments?: Node
  /** The interfaces a class implements. */
  implements?: readonly Node[]
  /** Whether a class or member is abstract. */
  abstract?: boolean
  /** The decorators of a class, member or parameter. */
  decorators?: readonly Node[]
  /** The key of a member, property, signature, enum member, mapped type or import attribute. */
  key?: Node
  /** The value of a member, property, literal, template element or import attribute. */
  value?: Node | string | number | boolean | bigint | RegExp | RegexValue | TemplateValue | null
  /** Whether a key is computed. */
  computed?: boolean
  /** Whether a member is static. */
  static?: boolean
  /** Which kind of method: `constructor`, `method`, `get` or `set`. */
  methodKind?: string
  /** Which kind of property: `init`, `get` or `set`. */
  propertyKind?: string
  /** The accessibility of a member: `public`, `protected` or `private`. */
  accessibility?: string
  /** Whether a member overrides. */
  override?: boolean
  /** Whether a member, parameter, tuple member or type is optional. */
  optional?: boolean | string
  /** Whether a member, parameter, signature or type is read-only. */
  readonly?: boolean | string
  /** The type annotation of an identifier, pattern, member, signature or mapped type. */
  typeAnnotation?: Node
  /** The specifiers of an import or export. */
  specifiers?: readonly Node[]
  /** The source of an import, export or dynamic import. */
  source?: Node | null
  /** Whether an import is of types or values. */
  importKind?: 'type' | 'value'
  /** Whether an export is of types or values. */
  exportKind?: 'type' | 'value'
  /** The import attributes. */
  attributes?: readonly Node[]
  /** The name imported by a specifier. */
  imported?: Node
  /** The local name of a specifier. */
  local?: Node
  /** The name exported by a specifier or namespace export. */
  exported?: Node | null
  /** The declaration an export carries. */
  declaration?: Node | null
  /** The module reference of an import equals. */
  moduleReference?: Node
  /** The name of an identifier, JSX identifier or private identifier. */
  name?: string | Node
  /** The raw text of a literal or JSX text. */
  raw?: string
  /** The pattern and flags of a regular expression literal. */
  regex?: RegexValue
  /** The digits of a bigint literal. */
  bigint?: string
  /** The quasis of a template literal or template literal type. */
  quasis?: readonly Node[]
  /** The expressions of a template literal or sequence. */
  expressions?: readonly Node[]
  /** Whether a template element is the last. */
  tail?: boolean
  /** The tag of a tagged template. */
  tag?: Node
  /** The quasi of a tagged template. */
  quasi?: Node
  /** The elements of an array expression or pattern, null for holes. */
  elements?: readonly (Node | null)[]
  /** The properties of an object expression or pattern. */
  properties?: readonly Node[]
  /** Whether a property is shorthand. */
  shorthand?: boolean
  /** Whether a property is a method. */
  method?: boolean
  /** The operator of a unary, update, binary, logical, assignment or type operator. */
  operator?: string
  /** Whether an update is prefix. */
  prefix?: boolean
  /** The callee of a call or new. */
  callee?: Node
  /** The arguments of a call or new. */
  arguments?: readonly Node[]
  /** The type arguments of a call, new, tagged template, reference, heritage, instantiation or JSX element. */
  typeArguments?: Node
  /** The property of a member expression or meta property. */
  property?: Node
  /** Whether a yield delegates. */
  delegate?: boolean
  /** The options of a dynamic import. */
  options?: Node | null
  /** The meta of a meta property. */
  meta?: Node
  /** The parameter a parameter property wraps. */
  parameter?: Node
  /** The opening element or fragment. */
  openingElement?: Node
  /** The closing element, null when self-closing. */
  closingElement?: Node | null
  /** The opening fragment. */
  openingFragment?: Node
  /** The closing fragment. */
  closingFragment?: Node
  /** The children of a JSX element or fragment. */
  children?: readonly Node[]
  /** Whether an opening element is self-closing. */
  selfClosing?: boolean
  /** The namespace of a namespaced name. */
  namespace?: Node
  /** The constraint of a type parameter or mapped type. */
  constraint?: Node
  /** The default of a type parameter. */
  default?: Node
  /** Whether a type parameter is `in`. */
  in?: boolean
  /** Whether a type parameter is `out`. */
  out?: boolean
  /** Whether a type parameter is `const`, or an enum is const. */
  const?: boolean
  /** The interfaces an interface extends. */
  extends?: readonly Node[]
  /** The members of an enum body, type literal or interface body. */
  members?: readonly Node[]
  /** Which kind of module declaration: `module`, `namespace` or `global`. */
  moduleKind?: string
  /** Whether a module declaration is global. */
  global?: boolean
  /** The name of a type reference. */
  typeName?: Node
  /** The types of a union, intersection or template literal type. */
  types?: readonly Node[]
  /** The element type of an array type or named tuple member. */
  elementType?: Node
  /** The element types of a tuple. */
  elementTypes?: readonly Node[]
  /** The check type of a conditional type. */
  checkType?: Node
  /** The extends type of a conditional type. */
  extendsType?: Node
  /** The true type of a conditional type. */
  trueType?: Node
  /** The false type of a conditional type. */
  falseType?: Node
  /** The type parameter of an infer type. */
  typeParameter?: Node
  /** The name type of a mapped type. */
  nameType?: Node | null
  /** The object type of an indexed access. */
  objectType?: Node
  /** The index type of an indexed access. */
  indexType?: Node
  /** The name queried by a type query. */
  exprName?: Node
  /** The qualifier of an import type. */
  qualifier?: Node | null
  /** The literal of a literal type. */
  literal?: Node
  /** The parameter name of a type predicate. */
  parameterName?: Node
  /** Whether a type predicate asserts. */
  asserts?: boolean
}

/** A node with the fields rules write to while building. */
export type Draft = { -readonly [Field in keyof Node]: Node[Field] }
