import type { EngineResult } from './decision-engine'
import { decisionFramework } from '../data/decision-framework'
import { HYPERFRONTEND_FAMILY_ID } from './decision-engine'
import { SITE_URL } from './site'

/** Where the record was generated, quoted so a reader can regenerate or challenge it. */
const ASSESSMENT_URL = `${SITE_URL}/docs/is-hyperfrontend-right-for-you/`

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
 * Turns the questionnaire's second-person wording into the voice of the team
 * filing the record.
 *
 * The questions address a reader; a decision record is written by the people
 * who answered them. Second and first person plural conjugate identically in
 * English, so swapping the pronouns is enough to change the voice without
 * rewriting the sentence.
 *
 * @param text - A phrase quoted from the dataset.
 * @returns The phrase in the first person plural.
 */
function firstPerson(text: string): string {
  return text
    .replace(/\byours\b/g, 'ours')
    .replace(/\bYours\b/g, 'Ours')
    .replace(/\byour\b/g, 'our')
    .replace(/\bYour\b/g, 'Our')
    .replace(/\byou\b/g, 'we')
    .replace(/\bYou\b/g, 'We')
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
  const label = question?.answers.find((candidate) => candidate.id === answerId)?.label
  return label ? firstPerson(label) : answerId
}

/**
 * Renders the assessment as a Markdown architecture decision record.
 *
 * The record is produced deterministically from the answers and the dataset:
 * the same answers against the same research snapshot always yield the same
 * document, so it can be diffed, reviewed, and argued with. No language model
 * writes any part of it. It is written as the record of the team that answered,
 * and it follows the same order as the page it was generated from.
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
  lines.push('Microfrontend architecture decision record.')
  lines.push('')
  lines.push(`- Generated: ${generatedOn}`)
  lines.push(`- Decision framework: v${metadata.frameworkVersion}`)
  lines.push(`- Research last verified: ${metadata.researchSnapshot}`)
  lines.push(`- Basis: ${metadata.unitCount} researched approaches compared across ${metadata.attributeCount} properties`)
  lines.push('')

  lines.push('## Verdict')
  lines.push('')
  if (result.outcome === 'no-match') {
    lines.push('No researched approach satisfies every hard requirement we recorded. The conflicts are listed below.')
  } else if (result.outcome === 'baselines-only') {
    lines.push('Microfrontends are not required. Every approach that survives our requirements ships as a single deployment.')
  } else if (result.outcome === 'open') {
    lines.push('Not enough was answered to narrow the field. Every approach remains a candidate.')
  } else {
    const names = result.surviving.filter((family) => family.kind === 'microfrontend').map((family) => family.name)
    lines.push(`Viable architectural approaches: ${names.join(', ')}.`)
  }
  lines.push('')
  const strengthLine: Record<string, string> = {
    'only-option': 'the only researched approach that meets every requirement we stated.',
    strong: 'a strong fit, with other approaches also viable.',
    good: 'a good fit, with other approaches also viable.',
    viable: 'viable, though nothing in our answers points squarely at it.',
    'ruled-out': 'ruled out.',
  }
  lines.push(
    result.hyperfrontend.viable
      ? `**HyperFrontend:** ${strengthLine[result.hyperfrontend.strength]} ${result.hyperfrontend.alternatives} other microfrontend approach(es) also survive.`
      : `**HyperFrontend:** ruled out by "${answerLabel(result.hyperfrontend.ruledOutBy?.questionId ?? '', result.hyperfrontend.ruledOutBy?.answerId ?? '')}".`
  )
  lines.push('')

  lines.push('## Recorded answers')
  lines.push('')
  lines.push('| Question | Answer | Weight |')
  lines.push('| --- | --- | --- |')
  for (const { question, answer } of result.answered) {
    lines.push(
      `| ${firstPerson(question.prompt)} | ${firstPerson(answer.label)} | ${answer.answerClass === 'hard' ? 'Hard requirement' : 'Preference'} |`
    )
  }
  if (result.answered.length === 0) lines.push('| No questions answered | | |')
  lines.push('')

  lines.push('## What those answers imply')
  lines.push('')
  for (const { answer } of result.answered) {
    lines.push(`- ${firstPerson(answer.consequence)}`)
  }
  if (result.answered.length === 0) lines.push('- Nothing yet.')
  lines.push('')

  lines.push(result.hyperfrontend.viable ? '## Why HyperFrontend fits' : '## Why HyperFrontend does not fit')
  lines.push('')
  if (result.hyperfrontend.viable) {
    if (result.hyperfrontend.matchedAnswers.length > 0) {
      lines.push('The answers that point at it:')
      lines.push('')
      for (const { answer } of result.hyperfrontend.matchedAnswers) lines.push(`- ${firstPerson(answer.label)}`)
      lines.push('')
    } else {
      lines.push('Nothing we recorded rules it out, though nothing points squarely at it either.')
      lines.push('')
    }
    lines.push('The separate-document architecture it implements asks for the following:')
    lines.push('')
    for (const requirement of hyperfrontendFloor) {
      lines.push(`- **${requirement.summary}** (${requirement.side}). ${requirement.detail}`)
    }
  } else {
    lines.push('It is not viable under our requirements. What would have to change:')
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
          ? `- The answer "${answerLabel(removed.by.questionId, removed.by.answerId)}" removed the whole separate-document approach, not one product.`
          : '- No specific requirement conflict was recorded.'
      )
    }
  }
  lines.push('')

  lines.push('## Viable approaches')
  lines.push('')
  for (const family of result.surviving) {
    lines.push(`### ${family.name}`)
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
  if (result.surviving.length === 0) {
    lines.push('None. No researched approach satisfies every requirement we recorded.')
    lines.push('')
  }

  lines.push('## Ruled out approaches')
  lines.push('')
  for (const { family, by } of result.eliminated) {
    lines.push(`- **${family.name}**: ruled out by "${answerLabel(by.questionId, by.answerId)}".`)
  }
  if (result.eliminated.length === 0) lines.push('- None.')
  lines.push('')

  lines.push('## Still open')
  lines.push('')
  const unanswered = result.relevant.filter((question) => !result.answered.some((entry) => entry.question.id === question.id))
  for (const question of unanswered) lines.push(`- ${firstPerson(question.prompt)}`)
  if (unanswered.length === 0) lines.push('- Nothing relevant is unanswered.')
  lines.push('')

  lines.push('## Method and caveats')
  lines.push('')
  lines.push(
    'Derived from boundaries, ownership, deployment, coordination, isolation, and change constraints rather than from feature lists. Generated deterministically from a dated research dataset, not by a language model.'
  )
  lines.push('')
  lines.push(
    `Research last verified ${metadata.researchSnapshot}. That reflects the maintainers' best factual understanding at that date; capabilities, project health, and availability change, so anything decisive is worth re-checking before it is committed to.`
  )
  lines.push('')
  lines.push(`Generated by the HyperFrontend fit assessment: ${ASSESSMENT_URL}`)

  return lines.join('\n')
}
