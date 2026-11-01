/**
 * A spec ends a child it spawned through `sendSignal` from `@hyperfrontend/testing/process` and
 * compares the exit with `cleanSignalExit`, rather than calling `kill('SIGINT')` or
 * `kill('SIGTERM')` and expecting an exit code: Windows delivers no signal and ends the child
 * outright, so the exit it reports differs by platform. A `kill` on anything but a child the
 * file itself spawned from `node:child_process` is left alone, as is `SIGKILL`, which ends a
 * child the same way everywhere.
 *
 * @module rules/workspace/no-signal-kill-in-tests
 */

import type { Node } from '@hyperfrontend/linter'
import type { Reference, ScopeAnalysis, Variable } from '@hyperfrontend/linter/helpers'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { referenceOf, scopeAnalysisOf } from '@hyperfrontend/linter/helpers'

/** The modules that spawn children. */
const CHILD_PROCESS_MODULES = createSet(['node:child_process', 'child_process'])

/** The functions whose result is a child process. */
const SPAWNERS = createSet(['spawn', 'fork', 'exec', 'execFile'])

/** What an identifier imports. */
interface Binding {
  /** The module imported from. */
  readonly module: string
  /** The name imported, or null for a default or namespace import. */
  readonly imported: string | null
}

/**
 * The variable an identifier read in expression position resolves to.
 *
 * @param analysis - The file's scope analysis
 * @param identifier - The identifier read
 * @returns The variable, or null when nothing in the file declares it
 */
function variableOf(analysis: ScopeAnalysis, identifier: Node): Variable | null {
  // why: an identifier read as an expression always makes a reference, so only its resolution can be missing.
  return (referenceOf(analysis, identifier) as Reference).resolved
}

/**
 * The import an identifier is bound to.
 *
 * @param analysis - The file's scope analysis
 * @param identifier - The identifier read
 * @returns The binding, or null when the identifier is not an import binding
 */
function importedFrom(analysis: ScopeAnalysis, identifier: Node): Binding | null {
  const def = variableOf(analysis, identifier)?.defs[0]
  if (def === undefined || def.kind !== 'ImportBinding' || def.node.kind === 'TSImportEqualsDeclaration') return null
  const module = ((def.parent as Node).source as Node).value as string
  if (def.node.kind !== 'ImportSpecifier') return { module, imported: null }
  const imported = def.node.imported as Node
  return { module, imported: (imported.name ?? imported.value) as string }
}

/**
 * Whether an expression spawns a child: a call to a spawner imported from a child-process
 * module, by name or through its default or namespace import.
 *
 * @param analysis - The file's scope analysis
 * @param node - The expression
 * @returns Whether it spawns
 */
function isSpawnCall(analysis: ScopeAnalysis, node: Node): boolean {
  if (node.kind !== 'CallExpression') return false
  const callee = node.callee as Node
  if (callee.kind === 'Identifier') {
    const binding = importedFrom(analysis, callee)
    return binding !== null && CHILD_PROCESS_MODULES.has(binding.module) && binding.imported !== null && SPAWNERS.has(binding.imported)
  }
  if (callee.kind !== 'MemberExpression' || callee.computed === true || (callee.object as Node).kind !== 'Identifier') return false
  const binding = importedFrom(analysis, callee.object as Node)
  return (
    binding !== null &&
    CHILD_PROCESS_MODULES.has(binding.module) &&
    binding.imported === null &&
    SPAWNERS.has((callee.property as Node).name as string)
  )
}

/**
 * Whether a receiver is a child the file spawned: a spawn call itself, or a variable one of
 * whose declarations or assignments is a spawn call.
 *
 * @param analysis - The file's scope analysis
 * @param receiver - The object `kill` is called on
 * @returns Whether the file spawned it
 */
function spawnedHere(analysis: ScopeAnalysis, receiver: Node): boolean {
  if (isSpawnCall(analysis, receiver)) return true
  if (receiver.kind !== 'Identifier') return false
  const variable = variableOf(analysis, receiver)
  if (variable === null) return false
  const values = [
    ...variable.defs.map((def) => (def.kind === 'Variable' ? (def.node.init as Node | null) : null)),
    ...variable.references.map((reference) => reference.writeExpr),
  ]
  return values.some((value) => value !== null && isSpawnCall(analysis, value))
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-signal-kill-in-tests',
  language: 'code',
  fixable: false,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    return {
      CallExpression(node) {
        const callee = node.callee as Node
        if (callee.kind !== 'MemberExpression' || callee.computed === true || (callee.property as Node).name !== 'kill') return
        const [signal] = node.arguments as readonly Node[]
        if (signal?.kind !== 'Literal' || typeof signal.value !== 'string' || !signal.value.startsWith('SIG') || signal.value === 'SIGKILL')
          return
        if (!spawnedHere(analysis, callee.object as Node)) return
        context.report({
          start: node.start,
          end: node.end,
          message: `Send '${signal.value}' to a child the test spawned with sendSignal from '@hyperfrontend/testing/process' and compare its exit with cleanSignalExit: Windows ends the child outright instead of delivering the signal, so the exit it reports differs by platform.`,
        })
      },
    }
  },
})
