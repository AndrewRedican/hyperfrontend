import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { ImportPlan } from './imports'
import type { CheckContext, Flavour, MessageIds, Tier } from './types'

/**
 * One way to resolve a finding, in a given separator flavour.
 */
export interface FlavourEdit {
  /** Short source-like description of the replacement, shown in suggestion text. */
  replacement: string
  /** The edit. */
  fix: TSESLint.ReportFixFunction
}

/**
 * Builds the edit for a flavour, or returns null when that edit cannot be made safely.
 */
export type EditBuilder = (flavour: Flavour) => FlavourEdit | null

/**
 * Picks the strongest evidence among several values: a proven native origin beats a
 * path-like name, which beats nothing.
 *
 * @param tiers - The tiers of the values involved.
 * @returns 1 when any value is proven native, else 2 when any is named like a path, else 0.
 */
export function strongestTier(tiers: readonly Tier[]): Tier {
  if (tiers.includes(1)) return 1
  return tiers.includes(2) ? 2 : 0
}

/**
 * Combines an import plan's edits with the edit that relies on them.
 *
 * @param plan - The import plan the edit relies on.
 * @param edit - The edit itself.
 * @returns A fix function applying both.
 */
export function fixWith(plan: ImportPlan, edit: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix): TSESLint.ReportFixFunction {
  return (fixer) => [...plan.fixes(fixer), edit(fixer)]
}

/**
 * Reports a finding whose remedy depends on how sure the rule is about the value's origin.
 * Tier 1 (proven native) gets the native edit as an autofix; tier 2 (named like a path) gets
 * both flavours as suggestions, since only the author knows which one the value is.
 *
 * @param check - The check context.
 * @param node - The node to report.
 * @param messageId - The finding's message.
 * @param tier - 1 or 2.
 * @param build - Builds the edit for each flavour.
 * @param data - Placeholder values for the message.
 */
export function reportTiered(
  check: CheckContext,
  node: TSESTree.Node,
  messageId: MessageIds,
  tier: Exclude<Tier, 0>,
  build: EditBuilder,
  data: Record<string, string> = {}
): void {
  if (tier === 1) {
    check.context.report({ node, messageId, data, fix: build('native')?.fix ?? null })
    return
  }
  const suggest: TSESLint.SuggestionReportDescriptor<MessageIds>[] = []
  const native = build('native')
  if (native) suggest.push({ messageId: 'treatAsNative', data: { replacement: native.replacement }, fix: native.fix })
  const portable = build('portable')
  if (portable) suggest.push({ messageId: 'treatAsPortable', data: { replacement: portable.replacement }, fix: portable.fix })
  check.context.report({ node, messageId, data, suggest })
}
