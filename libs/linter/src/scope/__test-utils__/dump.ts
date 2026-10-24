/**
 * The scope analysis written out in one canonical form, scope by scope with their variables,
 * references and resolutions, for the specs and the oracle to compare.
 *
 * @module scope/__test-utils__/dump
 */

import type { ScopeAnalysis } from '../analysis.ts'
import type { Variable } from '../model.ts'

const flag = (value: boolean): string => (value ? '1' : '0')

/**
 * Writes an analysis out, one line per scope, variable and reference.
 *
 * @param analysis - The analysis written out
 * @returns The lines
 *
 * @example Writing out the scopes of a one-line module
 * ```typescript
 * dumpScopes(analyzeScopes(parseCode('a\n', '.ts').tree as Node, DEFAULT_LANGUAGE))
 * // => ['S0 global Program 0-2 up=- strict=0', 'S1 module Program 0-2 up=0 strict=1', '  R 0 a r v init=0 we=- => ext', '  T 0']
 * ```
 */
export function dumpScopes(analysis: ScopeAnalysis): string[] {
  const { scopes } = analysis
  const lines: string[] = []
  // why: a reference resolved to a global and one left unresolved are one category: the linter treated both as global.
  const resolution = (variable: Variable | null): string =>
    variable === null || variable.defs.length === 0 ? 'ext' : `S${scopes.indexOf(variable.scope)}:${variable.name}`
  scopes.forEach((scope, index) => {
    const upper = scope.upper === null ? '-' : String(scopes.indexOf(scope.upper))
    lines.push(
      `S${index} ${scope.kind} ${scope.block.kind} ${scope.block.start}-${scope.block.end} up=${upper} strict=${flag(scope.isStrict)}`
    )
    for (const variable of scope.variables) {
      if (scope.kind === 'global' && variable.defs.length === 0) continue
      const defs = variable.defs.map((def) => `${def.kind}@${def.name.start}`).join(',')
      const ids = variable.identifiers.map((id) => id.start).join(',')
      const refs = variable.references.map((ref) => ref.identifier.start).join(',')
      lines.push(`  V ${variable.name} defs=${defs} ids=${ids} t=${flag(variable.isType)} v=${flag(variable.isValue)} refs=${refs}`)
    }
    for (const ref of scope.references) {
      const direction = `${ref.isRead() ? 'r' : ''}${ref.isWrite() ? 'w' : ''}`
      const kind = `${ref.isValueReference ? 'v' : ''}${ref.isTypeReference ? 't' : ''}`
      const written = ref.writeExpr === null ? '-' : String(ref.writeExpr.start)
      lines.push(
        `  R ${ref.identifier.start} ${String(ref.identifier.name)} ${direction} ${kind} init=${flag(ref.init)} we=${written} => ${resolution(ref.resolved)}`
      )
    }
    if (scope.kind !== 'global') lines.push(`  T ${scope.through.map((ref) => ref.identifier.start).join(',')}`)
  })
  return lines
}
