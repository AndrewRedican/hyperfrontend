import type { EngineResult } from './decision-engine'
import { decisionFramework } from '../data/decision-framework'
import { HYPERFRONTEND_FAMILY_ID } from './decision-engine'

/** Inputs needed to render a decision record. */
export interface DecisionRecordInput {
  /** The reader's local label for the assessment. */
  label: string
  /** ISO date the record was generated. */
  generatedOn: string
  /** The evaluated assessment. */
  result: EngineResult
}

/**
 * Resolves the answer text behind an elimination, so a record can quote the
 * reason rather than an identifier.
 *
 * @param questionId - Question that produced the elimination.
 * @param answerId - The answer chosen.
 * @returns The answer label, or the raw id when the dataset has moved on.
 */
function answerLabel(questionId: string, answerId: string): string {
  const question = decisionFramework.questions.find((candidate) => candidate.id === questionId)
  return question?.answers.find((candidate) => candidate.id === answerId)?.label ?? answerId
}

/**
 * Renders the assessment as a Markdown architecture decision record.
 *
 * The record is produced deterministically from the answers and the dataset:
 * the same answers against the same research snapshot always yield the same
 * document, so it can be diffed, reviewed, and argued with. No language model
 * writes any part of it.
 *
 * @param input - See {@link DecisionRecordInput}.
 * @param input.label - The reader's local label for the assessment.
 * @param input.generatedOn - ISO date the record was generated.
 * @param input.result - The evaluated assessment to render.
 * @returns The record as Markdown.
 * @example
 * ```ts
 * const md = buildDecisionRecord({ label: 'Portal modernization', generatedOn: '2026-08-29', result })
 * ```
 */
export function buildDecisionRecord({ label, generatedOn, result }: DecisionRecordInput): string {
  const { metadata, implementations, hyperfrontendFloor } = decisionFramework
  const title = label.trim() || 'Microfrontend architecture assessment'
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push('Microfrontend architecture decision record')
  lines.push('')
  lines.push(`- Generated: ${generatedOn}`)
  lines.push(`- Decision framework: v${metadata.frameworkVersion}`)
  lines.push(`- Research last verified: ${metadata.researchSnapshot}`)
  lines.push(`- Basis: ${metadata.unitCount} researched approaches compared across ${metadata.attributeCount} properties`)
  lines.push('')

  lines.push('## Decision')
  lines.push('')
  if (result.outcome === 'no-match') {
    lines.push('No researched architectural approach satisfies every hard requirement stated below. See "What would have to change".')
  } else if (result.outcome === 'baselines-only') {
    lines.push('Microfrontends are not required. Every approach that survives the stated requirements ships as a single deployment.')
  } else if (result.outcome === 'open') {
    lines.push('Not enough was answered to narrow the field. Every approach remains a candidate.')
  } else {
    const names = result.surviving.filter((family) => family.kind === 'microfrontend').map((family) => family.plainName)
    lines.push(`Viable architectural approaches: ${names.join(', ')}.`)
  }
  lines.push('')
  const strengthLine: Record<string, string> = {
    'only-option': 'the only researched approach that meets every stated requirement.',
    strong: 'a strong fit, with other approaches also viable.',
    good: 'a good fit, with other approaches also viable.',
    viable: 'viable, though nothing in the answers points squarely at it.',
    'ruled-out': 'ruled out.',
  }
  lines.push(
    result.hyperfrontend.viable
      ? `**HyperFrontend fit:** ${strengthLine[result.hyperfrontend.strength]} ${result.hyperfrontend.alternatives} other microfrontend approach(es) also survive.`
      : `**HyperFrontend fit:** ruled out by "${answerLabel(result.hyperfrontend.ruledOutBy?.questionId ?? '', result.hyperfrontend.ruledOutBy?.answerId ?? '')}".`
  )
  lines.push('')

  lines.push('## Inputs')
  lines.push('')
  lines.push('| Question | Answer | Weight |')
  lines.push('| --- | --- | --- |')
  for (const { question, answer } of result.answered) {
    lines.push(`| ${question.circumstance} | ${answer.label} | ${answer.answerClass === 'hard' ? 'Hard requirement' : 'Preference'} |`)
  }
  if (result.answered.length === 0) lines.push('| No questions answered | | |')
  lines.push('')

  lines.push('## Constraints derived')
  lines.push('')
  for (const { answer } of result.answered) {
    lines.push(`- ${answer.consequence}`)
  }
  if (result.answered.length === 0) lines.push('- None.')
  lines.push('')

  lines.push('## Eliminated approaches')
  lines.push('')
  for (const { family, by } of result.eliminated) {
    lines.push(`- **${family.plainName}**: ruled out by "${answerLabel(by.questionId, by.answerId)}".`)
  }
  if (result.eliminated.length === 0) lines.push('- None.')
  lines.push('')

  lines.push('## Viable approaches')
  lines.push('')
  for (const family of result.surviving) {
    lines.push(`### ${family.plainName}`)
    lines.push('')
    lines.push(family.definition)
    lines.push('')
    lines.push(`- Composition boundary: ${family.boundary}`)
    lines.push(`- Integration happens at: ${family.integrationPhase}`)
    lines.push(`- Costs accepted: ${family.costs.join('; ')}`)
    lines.push(`- Hard limitations: ${family.limitations.join('; ')}`)
    const impls = implementations.filter((impl) => impl.families.includes(family.id))
    if (impls.length > 0) {
      lines.push('- Implementations:')
      for (const impl of impls) {
        lines.push(`  - ${impl.name} (${impl.availability})${impl.url ? ` ${impl.url}` : ''}: ${impl.differsBy}`)
      }
    }
    lines.push('')
  }

  lines.push('## HyperFrontend fit')
  lines.push('')
  if (result.hyperfrontend.viable) {
    lines.push('The separate-document architecture HyperFrontend implements meets these requirements. It asks for the following:')
    lines.push('')
    for (const requirement of hyperfrontendFloor) {
      lines.push(`- **${requirement.summary}** (${requirement.side}). ${requirement.detail}`)
    }
  } else {
    lines.push('HyperFrontend is not viable under these requirements. What would have to change:')
    lines.push('')
    const conflicting = hyperfrontendFloor.filter((requirement) => result.hyperfrontend.conflicts.includes(requirement.id))
    for (const requirement of conflicting) {
      lines.push(`- **${requirement.summary}** (${requirement.side}). ${requirement.detail}`)
      lines.push(`  - What would have to change: ${requirement.whatWouldHaveToChange}`)
    }
    if (conflicting.length === 0) {
      const removed = result.eliminated.find((entry) => entry.family.id === HYPERFRONTEND_FAMILY_ID)
      lines.push(
        removed
          ? `- The answer "${answerLabel(removed.by.questionId, removed.by.answerId)}" removed the whole separate-document approach, not one HyperFrontend feature.`
          : '- No specific requirement conflict was recorded.'
      )
    }
  }
  lines.push('')

  if (result.hyperfrontend.viable && result.hyperfrontend.matchedAnswers.length > 0) {
    lines.push('')
    lines.push('### Why it fits')
    lines.push('')
    for (const { answer } of result.hyperfrontend.matchedAnswers) {
      lines.push(`- ${answer.label}: ${answer.consequence}`)
    }
  }
  lines.push('')

  lines.push('## Unresolved')
  lines.push('')
  const unanswered = result.relevant.filter((question) => !result.answered.some((entry) => entry.question.id === question.id))
  for (const question of unanswered) lines.push(`- ${question.circumstance}`)
  if (unanswered.length === 0) lines.push('- Nothing relevant is unanswered.')
  lines.push('')

  lines.push('## Method and caveats')
  lines.push('')
  lines.push(
    'Derived from boundaries, ownership, deployment, coordination, isolation, and change constraints rather than from feature lists. Generated deterministically from a dated research dataset, not by a language model.'
  )
  lines.push('')
  lines.push(
    `Research last verified ${metadata.researchSnapshot}. This reflects our best factual understanding at that date; capabilities, project health, and availability change, so re-check anything decisive before committing to it.`
  )

  return lines.join('\n')
}
