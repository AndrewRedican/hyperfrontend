/**
 * The code path builder: walks a program in evaluation order, opening a segment wherever
 * control may enter from more than one place and closing it wherever control leaves, so that
 * every node lands in the segment that evaluates it.
 *
 * @module flow/builder
 */

import type { Node } from '../code/model'
import type { CodePath, FlowAnalysis } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { CHILD_FIELDS } from '../code/children'
import { buildControl, isControl } from './build-control'
import { Segment } from './model'

/** A jump out of a construct, recorded where it leaves and completed where it lands. */
export interface Jump {
  /** `break`, `continue`, `return` or `throw`. */
  readonly kind: string
  /** The label named, or null. */
  readonly label: string | null
  /** The segment control leaves. */
  readonly segment: Segment
}

/** A construct a jump may target or pass through. */
export interface Context {
  /** `loop`, `switch`, `label`, `chain` or `try`. */
  readonly kind: string
  /** The label the construct carries, or null. */
  readonly label: string | null
  /** Segments that `break` out of the construct, or leave an optional chain. */
  readonly breaks: Segment[]
  /** Segments that `continue` the loop. */
  readonly continues: Segment[]
  /** For a try: the segments opened inside the block being built, from which an exception may leave. */
  readonly implicit: Segment[]
  /** For a try: the segments that throw inside the block being built. */
  readonly throws: Segment[]
  /** For a try with a finally: the jumps that pass through the finally. */
  readonly passing: Jump[]
  /** For a try: whether the block being built is the try block of one with a catch, where exceptions land. */
  catches: boolean
  /** For a try: whether the construct has a finally that abrupt exits pass through. */
  finalises: boolean
}

/** The fields never evaluated: type positions. */
const SKIPPED_FIELDS = createSet<string>([
  'typeAnnotation',
  'typeParameters',
  'returnType',
  'typeArguments',
  'superTypeArguments',
  'implements',
])

/** The kinds of node that open a code path of their own. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** The kinds of node evaluated as nothing: declarations of types and ambient things, imports. */
const SKIPPED_KINDS = createSet<string>([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
  'TSIndexSignature',
  'ImportDeclaration',
  'ExportAllDeclaration',
])

/**
 * A fresh construct record.
 *
 * @param kind - `loop`, `switch`, `label`, `chain` or `try`
 * @param label - The label the construct carries, or null
 * @returns The record, with nothing recorded yet
 *
 * @example Open a record for a labelled loop
 * ```ts
 * context('loop', 'outer')
 * // => { kind: 'loop', label: 'outer', breaks: [], continues: [], implicit: [],
 * //      throws: [], passing: [], catches: false, finalises: false }
 * ```
 */
export function context(kind: string, label: string | null): Context {
  return { kind, label, breaks: [], continues: [], implicit: [], throws: [], passing: [], catches: false, finalises: false }
}

/**
 * The walk over one program.
 *
 * @example Build a program's flow and read the analysis
 * ```ts
 * const builder = new Builder(parseCode('let ready = check()', '.ts').tree)
 * const analysis = builder.analysis()
 * analysis.paths.length // => 1 (only the program's path)
 * ```
 */
export class Builder {
  /** The segments control is in; empty when control cannot continue. */
  heads: Segment[] = []
  /** The constructs enclosing the point being built, innermost last. */
  contexts: Context[] = []
  /** The path being built. */
  path: CodePath
  /** Every path, the program's first. */
  readonly paths: CodePath[] = []
  /** The segment each node was evaluated in. */
  readonly segments = createMap<Node, Segment>()
  /** The path each segment belongs to. */
  readonly owners = createMap<Segment, CodePath>()
  /** The segments control is in at the end of each switch case. */
  readonly caseEnds = createMap<Node, readonly Segment[]>()
  /** How many segments have been opened. */
  private count = 0

  /**
   * Builds the control flow of a program.
   *
   * @param program - The program built
   */
  constructor(program: Node) {
    this.path = this.open(program, null)
    this.heads = [this.path.initial]
    this.statements(program.body as readonly Node[])
    this.close()
  }

  /**
   * The analysis built.
   *
   * @returns The paths and the lookups over them
   */
  analysis(): FlowAnalysis {
    return {
      paths: this.paths,
      segmentOf: (node) => this.segments.get(node),
      pathOf: (segment) => this.owners.get(segment) as CodePath,
      caseEnd: (switchCase) => this.caseEnds.get(switchCase) ?? [],
    }
  }

  /**
   * Opens a segment after the given segments and makes it the one head.
   *
   * @param prevs - The segments control comes from; the current heads unless given
   * @returns The segment opened
   */
  segment(prevs: readonly Segment[] = this.heads): Segment {
    const segment = new Segment(this.count, prevs)
    this.count += 1
    this.path.segments.push(segment)
    this.owners.set(segment, this.path)
    const enclosing = this.innermost('try')
    if (enclosing !== null) enclosing.implicit.push(segment)
    this.heads = [segment]
    return segment
  }

  /**
   * The segment to evaluate the next node in: the one head when control has not left it yet,
   * otherwise a new segment after the heads.
   *
   * @returns Where the next node is recorded
   */
  current(): Segment {
    const head = this.heads[0]
    return this.heads.length === 1 && head !== undefined && head.nexts.length === 0 ? head : this.segment()
  }

  /**
   * The innermost enclosing construct of a kind.
   *
   * @param kind - The construct's kind
   * @returns The construct, or null
   */
  innermost(kind: string): Context | null {
    for (let index = this.contexts.length - 1; index >= 0; index -= 1) {
      const candidate = this.contexts[index] as Context
      if (candidate.kind === kind) return candidate
    }
    return null
  }

  /**
   * Records that control leaves the current heads through a jump, and stops them: a throw
   * lands in the nearest catch, a jump with a finally in its way passes through it, a break or
   * continue lands in its target, a return or an uncaught throw ends the path.
   *
   * @param jump - The jump taken
   */
  leave(jump: Jump): void {
    this.heads = []
    for (let index = this.contexts.length - 1; index >= 0; index -= 1) {
      const enclosing = this.contexts[index] as Context
      if (enclosing.kind === 'try') {
        if (jump.kind === 'throw' && enclosing.catches) {
          enclosing.throws.push(jump.segment)
          return
        }
        if (enclosing.finalises) {
          enclosing.passing.push(jump)
          return
        }
        continue
      }
      if (jump.kind === 'throw' || jump.kind === 'return') continue
      const targeted =
        jump.label === null
          ? enclosing.kind === 'loop' || (enclosing.kind === 'switch' && jump.kind === 'break')
          : enclosing.label === jump.label
      if (!targeted) continue
      if (jump.kind === 'break') enclosing.breaks.push(jump.segment)
      else enclosing.continues.push(jump.segment)
      return
    }
    if (jump.kind === 'return') this.path.final.push(jump.segment)
    if (jump.kind === 'throw') this.path.thrown.push(jump.segment)
  }

  /**
   * Evaluates a node in the current segment: records it, then its children in evaluation order.
   *
   * @param node - The node, or nothing
   */
  visit(node: Node | null | undefined): void {
    if (node === null || node === undefined || SKIPPED_KINDS.has(node.kind)) return
    if (FUNCTIONS.has(node.kind)) {
      this.visitPath(node, () => {
        for (const param of node.params as readonly Node[]) this.visit(param)
        const body = node.body as Node
        if (body.kind === 'BlockStatement') this.statements(body.body as readonly Node[])
        else this.visit(body)
      })
      return
    }
    if (node.kind === 'StaticBlock') {
      this.visitPath(node, () => this.statements(node.body as readonly Node[]))
      return
    }
    const segment = this.current()
    segment.nodes.push(node)
    this.segments.set(node, segment)
    if (isControl(node)) buildControl(this, node)
    else if (node.kind === 'PropertyDefinition' || node.kind === 'AccessorProperty') this.visitField(node)
    else if (node.kind === 'VariableDeclarator') {
      // why: the initialiser is evaluated before the name is written, so its reads come first.
      this.visit(node.init)
      this.visit(node.id)
    } else this.children(node)
  }

  /**
   * Evaluates a node's children in evaluation order, leaving type positions out.
   *
   * @param node - The node whose children are evaluated
   */
  children(node: Node): void {
    for (const field of CHILD_FIELDS[node.kind]) {
      if (SKIPPED_FIELDS.has(field)) continue
      const value = node[field] as Node | readonly (Node | null)[] | null | undefined
      if (value === null || value === undefined) continue
      if ('kind' in value) this.visit(value)
      else for (const child of value) this.visit(child)
    }
  }

  /**
   * Evaluates statements in sequence.
   *
   * @param statements - The statements evaluated
   */
  statements(statements: readonly Node[]): void {
    for (const statement of statements) this.visit(statement)
  }

  /**
   * Evaluates a class field: its computed key in the class's path, its value in a path of its own.
   *
   * @param node - The field evaluated
   */
  private visitField(node: Node): void {
    if (node.computed === true) this.visit(node.key)
    const value = node.value as Node | null
    if (value !== null) this.visitPath(value, () => this.visit(value))
  }

  /**
   * Evaluates something in a code path of its own, then carries on in the enclosing one.
   *
   * @param root - The node whose evaluation the path describes
   * @param body - Evaluates the path's contents
   */
  private visitPath(root: Node, body: () => void): void {
    const outer = { heads: this.heads, contexts: this.contexts, path: this.path }
    this.path = this.open(root, outer.path)
    this.heads = [this.path.initial]
    this.contexts = []
    this.segments.set(root, this.path.initial)
    body()
    this.close()
    this.heads = outer.heads
    this.contexts = outer.contexts
    this.path = outer.path
  }

  /**
   * Opens a code path.
   *
   * @param root - The node whose evaluation it describes
   * @param upper - The path holding the root, or null
   * @returns The path, with its initial segment
   */
  private open(root: Node, upper: CodePath | null): CodePath {
    const path: CodePath = { root, upper, initial: new Segment(this.count, [], true), segments: [], final: [], thrown: [] }
    this.count += 1
    path.segments.push(path.initial)
    this.owners.set(path.initial, path)
    this.paths.push(path)
    return path
  }

  /**
   * Closes the path being built: the heads fall off its end.
   */
  private close(): void {
    // why: a switch of many breaking cases ends in as many heads, more than one call accepts as spread arguments.
    for (const head of this.heads) this.path.final.push(head)
  }
}
