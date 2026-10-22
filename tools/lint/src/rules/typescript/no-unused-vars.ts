/**
 * A variable, parameter, import, type or namespace declared and never read is noise or a
 * mistake: it is reported at its declaration, or at its last write in its own scope when it is
 * only ever assigned. A read serving the variable's own update does not count, nor does a
 * declaration's reference to itself. A value read only inside `typeof` queries is used only as
 * a type. Exports count as uses, as do the ambient exports of a declaration file and of a
 * declared namespace; parameters before the last used one, setter and signature parameters,
 * enum members and mapped type keys are never reported.
 *
 * @module rules/typescript/no-unused-vars
 */

import type { Node, SourceToken } from '../../code/model.ts'
import type { ScopeAnalysis } from '../../scope/analysis.ts'
import type { Reference, Scope, Variable } from '../../scope/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { tokenAfter } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'
import { isDefinitionFile } from './shared/definition-files.ts'

/** Whether a variable is used, and whether only as a type. */
interface Usage {
  /** Whether a reference reads the variable other than for its own update or declaration. */
  readonly used: boolean
  /** Whether every such reference sits inside a `typeof` query; meaningful when used. */
  readonly typeOnly: boolean
}

/** The kinds of node that are functions with bodies of their own. */
const FUNCTIONS = createSet<string>(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'])

/** The kinds of function expression a declarator's initialiser can be. */
const FUNCTION_EXPRESSIONS = createSet<string>(['ArrowFunctionExpression', 'FunctionExpression'])

/** The kinds of node that loop. */
const LOOPS = createSet<string>(['DoWhileStatement', 'ForInStatement', 'ForOfStatement', 'ForStatement', 'WhileStatement'])

/** The kinds of declaration that declare types. */
const TYPE_DECLARATIONS = createSet<string>(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'])

/** The assignment operators that read their target before writing it conditionally. */
const LOGICAL_ASSIGNMENTS = createSet<string>(['&&=', '||=', '??='])

export default defineRule<undefined, Node>({
  id: 'typescript/no-unused-vars',
  language: 'code',
  fixable: false,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    const definitionFile = isDefinitionFile(context.file.path)
    const markParameters = (node: Node): void => {
      for (const variable of analysis.declaredVariables(node))
        if (variable.defs.some((def) => def.kind === 'Parameter')) variable.used = true
    }
    const markDeclared = (node: Node): void => {
      for (const variable of analysis.declaredVariables(node)) variable.used = true
    }
    const markAmbient = (node: Node): void => {
      const parent = node.parent as Node
      if (parent.kind === 'Program') {
        if (definitionFile && !hasOverridingExports(parent)) markDeclared(node)
        return
      }
      if (parent.kind !== 'TSModuleBlock') return
      const module = parent.parent as Node
      if ((definitionFile || isAmbientModule(module)) && !hasOverridingExports(module)) markDeclared(node)
    }
    const markClass = (node: Node): void => {
      const id = node.id as Node | null
      // why: the class scope's own binding of the name is never reported; the one outside is.
      if (id !== null) (scopeOf(analysis, node).set.get(id.name as string) as Variable).used = true
    }
    const markSetterParameters = (node: Node): void => {
      if (node.methodKind === 'set' || node.propertyKind === 'set') markParameters(node.value as Node)
    }
    const markThis = (node: Node): void => {
      const [first] = node.params as readonly Node[]
      if (first?.kind === 'Identifier' && first.name === 'this') (scopeOf(analysis, node).set.get('this') as Variable).used = true
    }
    return {
      ClassDeclaration(node) {
        markClass(node)
        markAmbient(node)
      },
      ClassExpression: markClass,
      FunctionDeclaration: markThis,
      FunctionExpression: markThis,
      MethodDefinition: markSetterParameters,
      Property: markSetterParameters,
      TSCallSignatureDeclaration: markParameters,
      TSConstructSignatureDeclaration: markParameters,
      TSConstructorType: markParameters,
      TSEmptyBodyFunctionExpression: markParameters,
      TSFunctionType: markParameters,
      TSMethodSignature: markParameters,
      TSDeclareFunction(node) {
        markParameters(node)
        markAmbient(node)
      },
      TSEnumDeclaration(node) {
        // why: members are reachable through the enum, so they are never unused on their own.
        for (const variable of (analysis.scopesOf(node)[0] as Scope).variables) variable.used = true
        markAmbient(node)
      },
      TSInterfaceDeclaration: markAmbient,
      TSTypeAliasDeclaration: markAmbient,
      TSModuleDeclaration: markAmbient,
      VariableDeclaration: markAmbient,
      TSMappedType: markDeclared,
      TSParameterProperty(node) {
        const parameter = node.parameter as Node
        const id = parameter.kind === 'AssignmentPattern' ? (parameter.left as Node) : parameter
        ;(scopeOf(analysis, node).set.get(id.name as string) as Variable).used = true
      },
      'Program:exit'() {
        for (const scope of analysis.scopes) {
          // why: the name a function expression gives itself is only visible inside it.
          if (scope.kind === 'function-expression-name') continue
          for (const variable of scope.variables) {
            if (variable.used || variable.defs.length === 0 || isExported(variable)) continue
            const usage = usageOf(variable)
            const typeOnly = usage.typeOnly && !variable.defs.some((def) => def.kind === 'ImportBinding')
            if ((usage.used && !typeOnly) || isBeforeUsedParameter(analysis, variable)) continue
            const writes = variable.references.filter((ref) => ref.isWrite() && ref.from.variableScope === variable.scope.variableScope)
            const id = writes.length > 0 ? (writes[writes.length - 1] as Reference).identifier : (variable.identifiers[0] as Node)
            const action = variable.references.some((ref) => ref.isWrite()) ? 'assigned a value' : 'defined'
            // why: an annotated identifier spans its annotation; the report covers the name alone.
            const token = tokenAfter(context.tree, id.start) as SourceToken
            context.report({
              start: token.start,
              end: token.end,
              message: `'${variable.name}' is ${action} but ${usage.used ? 'only used as a type' : 'never used'}.`,
            })
          }
        }
      },
    }
  },
})

/**
 * Whether a module declaration is ambient: declared itself, or nested in a declared one.
 *
 * @param module - The module declaration
 * @returns Whether its declarations are ambient
 */
function isAmbientModule(module: Node): boolean {
  for (let current: Node | null = module; current !== null; current = current.parent) {
    if (current.kind === 'TSModuleDeclaration' && current.declare === true) return true
  }
  return false
}

/**
 * Whether a program or module block exports explicitly, which turns off its ambient exports:
 * an export list, a re-export of everything, an `export =` or a default export of a name.
 *
 * @param node - The program or the module declaration
 * @returns Whether an explicit export statement is among its statements
 */
function hasOverridingExports(node: Node): boolean {
  const statements = (node.kind === 'Program' ? node.body : (node.body as Node).body) as readonly Node[]
  return statements.some((statement) => {
    switch (statement.kind) {
      case 'ExportNamedDeclaration':
        return statement.declaration === null
      case 'ExportAllDeclaration':
      case 'TSExportAssignment':
        return true
      case 'ExportDefaultDeclaration':
        return (statement.declaration as Node).kind === 'Identifier'
      default:
        return false
    }
  })
}

/**
 * Whether a declaration of the variable is exported.
 *
 * @param variable - The candidate for a report
 * @returns Whether an export statement carries one of its declarations
 */
function isExported(variable: Variable): boolean {
  return variable.defs.some((def) => {
    if (def.kind === 'Parameter') return false
    const node = def.node.kind === 'VariableDeclarator' ? (def.node.parent as Node) : def.node
    return (node.parent as Node).kind.startsWith('Export')
  })
}

/**
 * Whether an unused parameter is left alone because a later parameter of its function is used.
 *
 * @param analysis - The program's scope analysis
 * @param variable - The candidate for a report
 * @returns Whether it is a plain parameter followed by a used one
 */
function isBeforeUsedParameter(analysis: ScopeAnalysis, variable: Variable): boolean {
  const def = variable.defs[0] as Variable['defs'][number]
  if (def.kind !== 'Parameter' || !FUNCTIONS.has((def.name.parent as Node).kind)) return false
  const declared = analysis.declaredVariables(def.node)
  return declared.slice(declared.indexOf(variable) + 1).some((later) => later.references.length > 0 || later.used)
}

/**
 * Whether a variable is used, and whether only inside `typeof` queries: a reference counts
 * when it reads the variable for something other than its own update, from outside the
 * function, type, namespace or enum that declares it.
 *
 * @param variable - The candidate whose references are read
 * @returns Its usage
 */
function usageOf(variable: Variable): Usage {
  const functions = createSet<Node>()
  const types = createSet<Node>()
  const modules = createSet<Node>()
  const enums = createSet<Node>()
  for (const def of variable.defs) {
    const { node } = def
    if (def.kind === 'FunctionName') functions.add(node)
    else if (def.kind === 'Variable' && node.init !== null && FUNCTION_EXPRESSIONS.has((node.init as Node).kind))
      functions.add(node.init as Node)
    else if (TYPE_DECLARATIONS.has(node.kind)) types.add(node)
    else if (node.kind === 'TSModuleDeclaration') modules.add(node)
    else if (node.kind === 'TSEnumDeclaration') enums.add(node)
  }
  let rhs: Node | null = null
  let used = false
  for (const ref of variable.references) {
    if (isForInOfRef(ref)) return { used: true, typeOnly: false }
    const forItself = isReadForItself(ref, rhs)
    rhs = rhsOf(ref, rhs)
    if (!ref.isRead() || forItself || isSelfReference(ref, functions) || isSelfReference(ref, modules)) continue
    if (isInsideAny(ref.identifier, types) || isInsideAny(ref.identifier, enums)) continue
    if (!isInTypeQuery(ref.identifier)) return { used: true, typeOnly: false }
    used = true
  }
  return { used, typeOnly: true }
}

/**
 * Whether a reference is the variable of a `for-in` or `for-of` whose body returns at once,
 * which uses the variable by iterating.
 *
 * @param ref - The reference
 * @returns Whether the loop counts as a use
 */
function isForInOfRef(ref: Reference): boolean {
  let target = ref.identifier.parent as Node
  if (target.kind === 'VariableDeclarator') target = (target.parent as Node).parent as Node
  if (target.kind !== 'ForInStatement' && target.kind !== 'ForOfStatement') return false
  const body = target.body as Node
  const first = body.kind === 'BlockStatement' ? (body.body as readonly Node[])[0] : body
  return first !== undefined && first.kind === 'ReturnStatement'
}

/**
 * Whether a read serves only the variable's own update: `a += 1` or `a++` as a statement, or a
 * read on the right of an assignment to the variable itself, unless inside a function that
 * may run later.
 *
 * @param ref - The reference
 * @param rhs - The right side of the assignment to the variable in effect, or null
 * @returns Whether the read counts for nothing
 */
function isReadForItself(ref: Reference, rhs: Node | null): boolean {
  if (!ref.isRead()) return false
  const id = ref.identifier
  const parent = id.parent as Node
  const selfUpdate =
    (parent.kind === 'AssignmentExpression' &&
      parent.left === id &&
      isUnusedExpression(parent) &&
      !LOGICAL_ASSIGNMENTS.has(parent.operator as string)) ||
    (parent.kind === 'UpdateExpression' && isUnusedExpression(parent))
  return selfUpdate || (rhs !== null && isInside(id, rhs) && !isInsideStorableFunction(id, rhs))
}

/**
 * Whether an expression's value is dropped: a statement of its own, or a member of a sequence
 * other than the last.
 *
 * @param node - The assignment or update asked about
 * @returns Whether nothing reads its value
 */
function isUnusedExpression(node: Node): boolean {
  const parent = node.parent as Node
  if (parent.kind === 'ExpressionStatement') return true
  if (parent.kind === 'SequenceExpression') {
    const expressions = parent.expressions as readonly Node[]
    return expressions[expressions.length - 1] !== node || isUnusedExpression(parent)
  }
  return false
}

/**
 * The right side of the assignment to the variable a reference makes, when the assignment is a
 * statement of its own in the variable's scope outside any loop, or the one in effect when the
 * reference sits inside it.
 *
 * @param ref - The reference
 * @param previous - The right side in effect so far, or null
 * @returns The right side in effect after the reference, or null
 */
function rhsOf(ref: Reference, previous: Node | null): Node | null {
  const id = ref.identifier
  const parent = id.parent as Node
  if (previous !== null && isInside(id, previous)) return previous
  const canBeUsedLater = ref.from.variableScope !== (ref.resolved as Variable).scope.variableScope || isInLoop(id)
  if (parent.kind === 'AssignmentExpression' && parent.left === id && isUnusedExpression(parent) && !canBeUsedLater)
    return parent.right as Node
  return null
}

/**
 * Whether a node sits in a loop of the function around it.
 *
 * @param node - The identifier asked about
 * @returns Whether a loop encloses it before any function does
 */
function isInLoop(node: Node): boolean {
  for (let current: Node | null = node; current !== null && !FUNCTIONS.has(current.kind); current = current.parent) {
    if (LOOPS.has(current.kind)) return true
  }
  return false
}

/**
 * Whether an identifier sits in a function, inside an assignment's right side, that the right
 * side stores somewhere it may run later.
 *
 * @param id - The identifier
 * @param rhs - The right side
 * @returns Whether the function may run later
 */
function isInsideStorableFunction(id: Node, rhs: Node): boolean {
  let func: Node | null = id.parent
  while (func !== null && !FUNCTIONS.has(func.kind)) func = func.parent
  return func !== null && isInside(func, rhs) && isStorableFunction(func, rhs)
}

/**
 * Whether a function inside an assignment's right side is stored rather than called at once:
 * passed to a call, assigned, yielded, tagged, or held by a statement too complex to follow.
 *
 * @param func - The callable held by the right side
 * @param rhs - The right side holding it
 * @returns Whether the function may run later
 */
function isStorableFunction(func: Node, rhs: Node): boolean {
  let node = func
  let parent = func.parent as Node
  while (isInside(parent, rhs)) {
    switch (parent.kind) {
      case 'SequenceExpression': {
        const expressions = parent.expressions as readonly Node[]
        if (expressions[expressions.length - 1] !== node) return false
        break
      }
      case 'CallExpression':
      case 'NewExpression':
        return parent.callee !== node
      case 'AssignmentExpression':
      case 'TaggedTemplateExpression':
      case 'YieldExpression':
        return true
      default:
        if (parent.kind.endsWith('Statement') || parent.kind.endsWith('Declaration')) return true
    }
    node = parent
    parent = parent.parent as Node
  }
  return false
}

/**
 * Whether a reference is made from inside one of the nodes, which then refers to itself.
 *
 * @param ref - The read whose scope chain is walked
 * @param nodes - The declaring functions or namespaces
 * @returns Whether a scope the reference is made from belongs to one of them
 */
function isSelfReference(ref: Reference, nodes: ReadonlySet<Node>): boolean {
  for (let scope: Scope | null = ref.from; scope !== null; scope = scope.upper) if (nodes.has(scope.block)) return true
  return false
}

/**
 * Whether a node sits inside one of the nodes.
 *
 * @param node - The identifier looked for
 * @param nodes - The candidates
 * @returns Whether one of them spans it
 */
function isInsideAny(node: Node, nodes: ReadonlySet<Node>): boolean {
  for (const candidate of nodes) if (isInside(node, candidate)) return true
  return false
}

/**
 * Whether one node's span lies within another's.
 *
 * @param inner - The node that may be inside
 * @param outer - The node that may span it
 * @returns Whether it does
 */
function isInside(inner: Node, outer: Node): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

/**
 * Whether an identifier is the name a `typeof` query reads, directly or as the leftmost part of
 * a qualified name.
 *
 * @param node - The identifier, or the qualified name built on it
 * @returns Whether a type query holds it
 */
function isInTypeQuery(node: Node): boolean {
  const parent = node.parent as Node
  if (parent.kind === 'TSTypeQuery') return true
  return parent.kind === 'TSQualifiedName' && isInTypeQuery(parent)
}
