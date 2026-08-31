import type { Edit } from './edits'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getRequireSpecifier, parseChunk, resolveRelativeTarget } from './ast-utils'
import { applyEdits } from './edits'
import { classifyNamespaceUse } from './namespace-usage'

/**
 * Outcome of destructuring a single CJS chunk's whole-module require bindings.
 */
export interface DestructureResult {
  /** Rewritten chunk source. */
  code: string
  /** Number of `const NS = require(...)` bindings collapsed to destructures. */
  rewrittenBindings: number
}

/** One exported name paired with the local identifier it binds to in a destructure. */
interface BindingAssignment {
  /** Exported name as published by the required chunk. */
  exported: string
  /** Local identifier the export is bound to (equal to `exported` unless aliased). */
  local: string
}

/**
 * A whole-module require binding (`const NS = require('./rel')`) under
 * consideration for destructuring.
 */
interface Candidate {
  /** Local identifier bound to the required module. */
  local: string
  /** The binding identifier node, so the use-scan can skip it and the edit can replace it. */
  nameNode: ts.Identifier
  /** Property reads keyed by exported name → the member-access nodes selecting it. */
  members: Map<string, ts.Node[]>
  /** True once any non-static use is seen; the binding is then left untouched. */
  bail: boolean
}

// why: an identifier is a free reference or a binding name unless it sits in a member-name / object-key position, where it never introduces or reads a top-level-visible name. The reserved set is what new destructured locals must avoid colliding with.
const isNameOnlyPosition = (id: ts.Identifier): boolean => {
  const parent = id.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return true
  if (ts.isPropertyAssignment(parent) && parent.name === id) return true
  if (ts.isBindingElement(parent) && parent.propertyName === id) return true
  return false
}

const collectReserved = (sourceFile: ts.SourceFile, bindingNodes: Set<ts.Node>): Set<string> => {
  const reserved = createSet<string>([])
  const visit = (node: ts.Node): void => {
    // why: a candidate's own binding name is being removed, so it never blocks a chosen local.
    if (ts.isIdentifier(node) && !bindingNodes.has(node) && !isNameOnlyPosition(node)) reserved.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return reserved
}

const collectCandidates = (
  sourceFile: ts.SourceFile,
  chunkDir: string,
  isSafeTarget: (target: string) => boolean
): Map<string, Candidate> => {
  const candidates = createMap<string, Candidate>()
  const seen = createSet<string>([])
  const visit = (node: ts.Node): void => {
    const specifier = getRequireSpecifier(node)
    if (specifier !== null) {
      const target = resolveRelativeTarget(chunkDir, specifier)
      const parent = node.parent
      // why: when a `require` call's direct parent is a `VariableDeclaration`, the call is necessarily its initializer (a declaration's only expression child), so no separate initializer check is needed.
      if (target !== null && isSafeTarget(target) && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        const local = parent.name.text
        // why: a local bound twice cannot be tracked unambiguously by text scan — drop it from consideration entirely.
        if (seen.has(local)) candidates.delete(local)
        else {
          seen.add(local)
          candidates.set(local, { local, nameNode: parent.name, members: createMap<string, ts.Node[]>(), bail: false })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return candidates
}

// why: a destructure shorthand `const { name } = require(...)` is legal only when `name` is a real BindingIdentifier — so lex `name` whole. A single `Identifier` followed by end-of-input proves it: a keyword (`default`, and strict-reserved `let`/`yield`/`static`/`await`, illegal in rollup's strict CJS) lexes to its own keyword token, not `Identifier`; a non-identifier key (`foo-bar` from `NS["foo-bar"]`) lexes to `Identifier` + more tokens, so the EOF check fails. Over-bailing a rare contextual export name (`as`/`type`) is safe: it keeps the namespace form, which is valid.
const isValidBindingName = (name: string): boolean => {
  const scanner = ts.createScanner(ts.ScriptTarget.ESNext, /*skipTrivia*/ true, ts.LanguageVariant.Standard, name)
  return scanner.scan() === ts.SyntaxKind.Identifier && scanner.scan() === ts.SyntaxKind.EndOfFileToken
}

const scanUses = (sourceFile: ts.SourceFile, candidates: Map<string, Candidate>, bindingNodes: Set<ts.Node>): void => {
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !bindingNodes.has(node)) {
      const candidate = candidates.get(node.text)
      if (candidate && !candidate.bail) {
        const classification = classifyNamespaceUse(node)
        // why: a member named by a non-identifier (`m['foo-bar']`) or a keyword (`m.default`) cannot be destructured to a legal `const { … }` binding — bail the whole candidate to its namespace form rather than emit invalid JS.
        if (classification.kind === 'bail' || (classification.kind === 'read' && !isValidBindingName(classification.prop)))
          candidate.bail = true
        else if (classification.kind === 'read') {
          const nodes = candidate.members.get(classification.prop) ?? []
          nodes.push(node.parent)
          candidate.members.set(classification.prop, nodes)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

const renderBindingPattern = (assignments: BindingAssignment[]): string =>
  `{ ${assignments.map(({ exported, local }) => (exported === local ? exported : `${exported}: ${local}`)).join(', ')} }`

const allocateLocal = (exported: string, taken: Set<string>): string => {
  if (!taken.has(exported)) return exported
  let suffix = 1
  while (taken.has(`${exported}$${suffix}`)) suffix += 1
  return `${exported}$${suffix}`
}

/**
 * Rewrites whole-module CJS require bindings to destructuring binds when the
 * binding is consumed only as static member reads.
 *
 * For every top-level `const NS = require('./rel')` whose target `isSafeTarget`
 * accepts (a relative sibling chunk that is provably not in a `require` cycle
 * with this chunk), and where `NS` is used exclusively as `NS.member` /
 * `NS['member']` reads, the binding is collapsed to `const { member, … } =
 * require('./rel')` and each `NS.member` access is replaced by the bound local.
 * Locals that would collide with an existing free identifier or another bound
 * local are aliased (`member: member$1`), so the rewrite never shadows the
 * chunk's own names. Any wholesale, dynamic, or reassigning use of `NS` leaves
 * its binding untouched, matching rollup's namespace-access codegen.
 *
 * The cycle guard is the caller's responsibility: rollup keeps the namespace
 * form precisely so an eager destructure cannot capture an export before a
 * circular dependency has initialized it. Passing only acyclic targets to
 * `isSafeTarget` preserves that guarantee.
 *
 * @param source - Raw CJS chunk source text.
 * @param chunkDir - Absolute directory of the chunk, for resolving relative requires.
 * @param isSafeTarget - Predicate selecting which resolved require targets may be destructured.
 * @returns The rewritten source and the count of bindings destructured, or `null`
 * when no binding qualified.
 *
 * @example Destructuring a single-member require
 * ```typescript
 * destructureRequires("const m = require('./math/index.cjs.js');\nm.abs(x);", '/d/p', () => true)
 * // => { code: "const { abs } = require('./math/index.cjs.js');\nabs(x);", rewrittenBindings: 1 }
 * ```
 */
export const destructureRequires = (
  source: string,
  chunkDir: string,
  isSafeTarget: (target: string) => boolean
): DestructureResult | null => {
  const sourceFile = parseChunk(source)
  const candidates = collectCandidates(sourceFile, chunkDir, isSafeTarget)
  if (candidates.size === 0) return null
  const bindingNodes = createSet<ts.Node>([...candidates.values()].map((candidate) => candidate.nameNode))
  scanUses(sourceFile, candidates, bindingNodes)

  const qualified = [...candidates.values()].filter((candidate) => !candidate.bail && candidate.members.size > 0)
  if (qualified.length === 0) return null
  // why: every binding being collapsed frees its own name, so exclude binding nodes; new locals must dodge all other free identifiers.
  const taken = collectReserved(sourceFile, bindingNodes)

  const edits: Edit[] = []
  for (const candidate of qualified) {
    const assignments: BindingAssignment[] = []
    for (const exported of [...candidate.members.keys()].sort()) {
      const local = allocateLocal(exported, taken)
      taken.add(local)
      assignments.push({ exported, local })
      // why: the member-access node (`NS.member` or `NS['member']`) collapses to the bound local; the key came from this same map, so the lookup always resolves.
      for (const accessNode of candidate.members.get(exported) as ts.Node[])
        edits.push({ start: accessNode.getStart(sourceFile), end: accessNode.getEnd(), text: local })
    }
    edits.push({
      start: candidate.nameNode.getStart(sourceFile),
      end: candidate.nameNode.getEnd(),
      text: renderBindingPattern(assignments),
    })
  }
  return { code: applyEdits(source, edits), rewrittenBindings: qualified.length }
}
