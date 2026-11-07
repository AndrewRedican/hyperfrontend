/**
 * From the requested roots, the declarations reached within each request's depth, where every
 * reference leads, and which output each declaration is placed in.
 *
 * @module types-extract/walk
 */

import type { BoundaryConfig, RequestConfig } from './config'
import type { FileIndex } from './index-file'
import type { Oddity, TypeReference } from './references'
import type { NameResolution, ResolutionContext, SymbolResolution } from './resolve-name'
import { builtinModules } from 'node:module'
import ts from 'typescript'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { declaredNames } from './index-file'
import { collectReferences } from './references'
import { indexOf, resolveExport, resolveName } from './resolve-name'
import { sourcePath } from './sources'
import { classToInterface, enumMemberType, enumToAlias } from './synthesize'

/** Why a reference is written as something other than the name it refers to. */
export type ReplaceReason =
  | 'override'
  | 'external-module'
  | 'unresolved'
  | 'qualified-name'
  | 'value-declaration'
  | 'namespace'
  | 'enum-member'
  | 'pending'

/** A reference to a declaration in the followed sources. */
export interface SymbolTarget {
  /** The target's kind. */
  readonly kind: 'symbol'
  /** The declaration's key. */
  readonly key: string
}

/** A reference to a global such as `Record`, kept as written. */
export interface GlobalTarget {
  /** The target's kind. */
  readonly kind: 'global'
}

/** A reference to an export of a Node built-in module, kept as an import. */
export interface ExternalTarget {
  /** The target's kind. */
  readonly kind: 'external'
  /** The module, as `node:<name>`. */
  readonly module: string
  /** The exported name. */
  readonly name: string
}

/** A reference written as other text. */
export interface ReplaceTarget {
  /** The target's kind. */
  readonly kind: 'replace'
  /** The text written. */
  readonly text: string
  /** Why the reference is not carried as written. */
  readonly reason: ReplaceReason
}

/** Where a reference leads. */
export type ReferenceTarget = SymbolTarget | GlobalTarget | ExternalTarget | ReplaceTarget

/** One reference with where it leads. */
export interface ResolvedReference {
  /** The reference. */
  readonly reference: TypeReference
  /** Where it leads. */
  readonly target: ReferenceTarget
}

/** One declaration statement of a symbol, ready to emit. */
export interface Declaration {
  /** The file holding the statement: the upstream file, or a synthesized one. */
  readonly sourceFile: ts.SourceFile
  /** The statement. */
  readonly node: ts.Statement
  /** What it refers to. */
  readonly references: readonly ResolvedReference[]
  /** What in it is rewritten. */
  readonly oddities: readonly Oddity[]
}

/** How a symbol is declared. */
export type SymbolKind = 'type' | 'class' | 'enum' | 'value' | 'namespace'

/** One declared name in the followed sources. */
export interface GraphSymbol {
  /** `<file>#<name>`, or `<file>#<namespace>.<name>` for a namespace member. */
  readonly key: string
  /** The declaring file's path. */
  readonly file: string
  /** The name as declared. */
  readonly name: string
  /** The name the declaration is emitted under when nothing collides: the name, or `<namespace>_<name>`. */
  readonly baseName: string
  /** How it is declared. */
  readonly kind: SymbolKind
  /** The statements emitted for it; empty for values and namespaces. */
  readonly declarations: readonly Declaration[]
  /** What the extraction changed about it, as sentences for the report. */
  readonly notes: readonly string[]
}

/** What one request places in its output. */
export interface OutputPlan {
  /** The request. */
  readonly request: RequestConfig
  /** The keys of the roots, in request order. */
  readonly roots: readonly string[]
  /** The keys placed in the output, roots first, then in the order they were reached. */
  readonly order: readonly string[]
}

/** What the walk found: the symbols reached, where each is placed, and what is still to read. */
export interface WalkResult {
  /** Files that must be read before the walk can finish; empty when it did. */
  readonly pending: readonly string[]
  /** Every symbol reached, by key. */
  readonly symbols: ReadonlyMap<string, GraphSymbol>
  /** The output each placed symbol is written to, by key. */
  readonly placements: ReadonlyMap<string, string>
  /** What each output holds, by output path, in request order. */
  readonly outputs: ReadonlyMap<string, OutputPlan>
}

const BUILTINS = createSet(builtinModules)

/**
 * Whether a module specifier names a Node built-in.
 *
 * @param module - The specifier
 * @returns True for `node:` specifiers and bare built-in names
 */
export function isNodeBuiltin(module: string): boolean {
  return module.startsWith('node:') || BUILTINS.has(module)
}

/**
 * The kind of a set of statements declaring one name.
 *
 * @param statements - Every top-level statement declaring the name
 * @returns The kind: a class or enum when one is declared, a value for functions and variables, a type otherwise
 */
function kindOf(statements: readonly ts.Statement[]): SymbolKind {
  if (statements.some(ts.isClassDeclaration)) return 'class'
  if (statements.some(ts.isEnumDeclaration)) return 'enum'
  if (statements.some((statement) => ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))) return 'type'
  if (statements.some(ts.isModuleDeclaration)) return 'namespace'
  return 'value'
}

/**
 * Walks the requests over the sources read so far.
 *
 * @param requests - The requests, in placement order
 * @param boundary - How references past the boundary are written
 * @param context - The sources and their indexes
 * @returns The result, or the files still to read
 */
export function walk(requests: readonly RequestConfig[], boundary: BoundaryConfig, context: ResolutionContext): WalkResult {
  const pending = createSet<string>()
  const symbols = createMap<string, GraphSymbol>()
  const parsed = createMap<string, ts.SourceFile>()
  const replace = (reason: ReplaceReason, text: string = boundary.default): ReferenceTarget => ({ kind: 'replace', text, reason })

  const synthesized = (key: string, text: string): ts.SourceFile => {
    const sourceFile = ts.createSourceFile(`${key}.ts`, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    parsed.set(key, sourceFile)
    return sourceFile
  }

  const describe = (origin: FileIndex, sourceFile: ts.SourceFile, node: ts.Statement): Declaration => {
    const collected = collectReferences(node, sourceFile)
    return {
      sourceFile,
      node,
      references: collected.references.map((reference) => ({ reference, target: targetOf(origin, reference) })),
      oddities: collected.oddities,
    }
  }

  const build = (
    key: string,
    file: string,
    name: string,
    baseName: string,
    statements: readonly ts.Statement[],
    notes: string[] = []
  ): GraphSymbol => {
    const origin = indexOf(context, file)
    const kind = kindOf(statements)
    const declarations: Declaration[] = []
    const placeholder: GraphSymbol = { key, file, name, baseName, kind, declarations, notes }
    symbols.set(key, placeholder)
    if (kind === 'class') {
      const node = statements.find(ts.isClassDeclaration) as ts.ClassDeclaration
      const result = classToInterface(node, origin.sourceFile)
      notes.push(...result.notes)
      const sourceFile = synthesized(key, result.text)
      declarations.push(describe(origin, sourceFile, sourceFile.statements[0] as ts.Statement))
    } else if (kind === 'enum') {
      const node = statements.find(ts.isEnumDeclaration) as ts.EnumDeclaration
      const result = enumToAlias(node, origin.sourceFile)
      notes.push(...result.notes)
      const sourceFile = synthesized(key, result.text)
      declarations.push(describe(origin, sourceFile, sourceFile.statements[0] as ts.Statement))
    } else if (kind === 'type') {
      for (const statement of statements) {
        if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))
          declarations.push(describe(origin, origin.sourceFile, statement))
        else notes.push(`a merged ${ts.SyntaxKind[statement.kind]} is dropped; only the type declarations are carried`)
      }
    }
    return placeholder
  }

  const symbolFor = (file: string, name: string): GraphSymbol => {
    const key = `${file}#${name}`
    // note: a name resolves to a symbol only when its file declares it, so the declarations exist.
    return symbols.get(key) ?? build(key, file, name, name, indexOf(context, file).declarations.get(name) as readonly ts.Statement[])
  }

  const memberSymbol = (file: string, namespace: ts.ModuleDeclaration, name: string): GraphSymbol | null => {
    const key = `${file}#${namespace.name.getText()}.${name}`
    const existing = symbols.get(key)
    if (existing !== undefined) return existing
    const body = namespace.body
    if (body === undefined || !ts.isModuleBlock(body)) return null
    const statements = body.statements.filter((statement) => declaredNames(statement).includes(name))
    if (statements.length === 0) return null
    const baseName = `${namespace.name.getText()}_${name}`
    return build(key, file, name, baseName, statements, [`a member of the namespace ${namespace.name.getText()}, carried as ${baseName}`])
  }

  const symbolTarget = (resolution: SymbolResolution): ReferenceTarget => {
    const override = boundary.overrides[resolution.name]
    if (override !== undefined) return replace('override', override)
    const symbol = symbolFor(resolution.file, resolution.name)
    if (symbol.kind === 'value') return replace('value-declaration')
    if (symbol.kind === 'namespace') return replace('namespace')
    return { kind: 'symbol', key: symbol.key }
  }

  const fromResolution = (resolution: NameResolution): ReferenceTarget => {
    switch (resolution.kind) {
      case 'symbol':
        return symbolTarget(resolution)
      case 'global':
        return { kind: 'global' }
      case 'external':
        return isNodeBuiltin(resolution.module)
          ? {
              kind: 'external',
              module: resolution.module.startsWith('node:') ? resolution.module : `node:${resolution.module}`,
              name: resolution.name,
            }
          : replace('external-module')
      case 'missing':
        return replace('unresolved')
      case 'namespace':
        return replace('namespace')
      default:
        for (const path of resolution.paths) pending.add(path)
        return replace('pending')
    }
  }

  const qualifiedTarget = (resolution: NameResolution, reference: TypeReference): ReferenceTarget => {
    if (resolution.kind === 'namespace') return fromResolution(resolveExport(context, indexOf(context, resolution.file), reference.name))
    if (resolution.kind === 'global') return { kind: 'global' }
    if (resolution.kind === 'external') {
      return isNodeBuiltin(resolution.module)
        ? {
            kind: 'external',
            module: resolution.module.startsWith('node:') ? resolution.module : `node:${resolution.module}`,
            name: reference.name,
          }
        : replace('external-module')
    }
    if (resolution.kind !== 'symbol') return fromResolution(resolution)
    const head = symbolFor(resolution.file, resolution.name)
    const statements = indexOf(context, resolution.file).declarations.get(resolution.name) as readonly ts.Statement[]
    if (head.kind === 'enum') {
      const literal = enumMemberType(statements.find(ts.isEnumDeclaration) as ts.EnumDeclaration, reference.name)
      return literal === null ? replace('enum-member') : replace('enum-member', literal)
    }
    if (head.kind === 'namespace') {
      const member = memberSymbol(resolution.file, statements.find(ts.isModuleDeclaration) as ts.ModuleDeclaration, reference.name)
      if (member === null) return replace('unresolved')
      return member.kind === 'value' ? replace('value-declaration') : { kind: 'symbol', key: member.key }
    }
    return replace('qualified-name')
  }

  const targetOf = (origin: FileIndex, reference: TypeReference): ReferenceTarget => {
    if (reference.deep) return replace('qualified-name')
    const resolution = resolveName(context, origin, reference.qualifier ?? reference.name)
    return reference.qualifier === null ? fromResolution(resolution) : qualifiedTarget(resolution, reference)
  }

  const rootKeys = (request: RequestConfig): string[] | null => {
    const path = sourcePath(request.source, request.root)
    if (!context.files.has(path)) {
      pending.add(path)
      return null
    }
    if (context.files.get(path) === null) throw createError(`${request.source}: the root module ${request.root} does not exist`)
    const index = indexOf(context, path)
    const keys: string[] = []
    for (const name of request.symbols) {
      const resolution = resolveExport(context, index, name)
      if (resolution.kind === 'pending') {
        for (const pendingPath of resolution.paths) pending.add(pendingPath)
        return null
      }
      if (resolution.kind !== 'symbol') throw createError(`${request.source}: ${request.root} does not export ${name}`)
      const symbol = symbolFor(resolution.file, resolution.name)
      if (symbol.kind === 'value' || symbol.kind === 'namespace')
        throw createError(`${request.source}: ${name} in ${request.root} is not a type`)
      keys.push(symbol.key)
    }
    return keys
  }

  const plans: OutputPlan[] = []
  for (const request of requests) {
    const roots = rootKeys(request)
    if (roots === null) continue
    const reached = createMap<string, number>()
    const queue: [string, number][] = roots.map((key) => [key, 0])
    while (queue.length > 0) {
      const [key, depth] = queue.shift() as [string, number]
      if (reached.has(key)) continue
      reached.set(key, depth)
      if (depth === request.depth) continue
      for (const declaration of (symbols.get(key) as GraphSymbol).declarations) {
        for (const { target } of declaration.references) {
          if (target.kind === 'symbol' && !reached.has(target.key)) queue.push([target.key, depth + 1])
        }
      }
    }
    plans.push({ request, roots, order: [...reached.keys()] })
  }
  if (pending.size > 0) return { pending: [...pending].sort(), symbols, placements: createMap(), outputs: createMap() }
  const placements = createMap<string, string>()
  const outputs = createMap<string, OutputPlan>()
  // why: a root belongs to the output that asked for it, whatever other request reached it first; the rest goes to the first request that reached it.
  for (const plan of plans) for (const key of plan.roots) if (!placements.has(key)) placements.set(key, plan.request.output)
  for (const plan of plans) {
    for (const key of plan.order) if (!placements.has(key)) placements.set(key, plan.request.output)
  }
  for (const plan of plans) {
    outputs.set(plan.request.output, { ...plan, order: plan.order.filter((key) => placements.get(key) === plan.request.output) })
  }
  return { pending: [], symbols, placements, outputs }
}
