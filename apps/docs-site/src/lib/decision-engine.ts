import type { Answer, Family, Question } from '../data/decision-framework'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { decisionFramework } from '../data/decision-framework'

/** Local storage key holding the reader's in-progress or completed assessment. */
export const ASSESSMENT_STORAGE_KEY = 'hf-mfe-assessment'

/** The family id hyperfrontend implements, used to report where it landed. */
export const HYPERFRONTEND_FAMILY_ID = 'family.document-embedding'

/** An assessment as persisted in the reader's browser. Never leaves the device. */
export interface StoredAssessment {
  /** Framework version that produced the answers, so a stale shape can be detected. */
  version: string
  /** Research snapshot the answers were given against. */
  researchSnapshot: string
  /** ISO date the assessment was last written. */
  savedAt: string
  /** The reader's own label for the assessment. Local only. */
  label: string
  /** Selected answer id, keyed by question id. */
  answers: Record<string, string>
}

/** The answer that removed a family from the candidate set. */
export interface Elimination {
  /** Family that was ruled out. */
  familyId: string
  /** Question whose answer ruled it out. */
  questionId: string
  /** The specific answer responsible. */
  answerId: string
}

/** A family removed from the candidate set, paired with the answer that removed it. */
export interface EliminatedFamily {
  /** The family that is no longer a candidate. */
  family: Family
  /** The answer that ruled it out. */
  by: Elimination
}

/** A question the reader answered, paired with the answer they chose. */
export interface AnsweredQuestion {
  /** The question that was put to the reader. */
  question: Question
  /** The answer they selected. */
  answer: Answer
}

/** The outcome class an assessment resolves to. */
export type Outcome = 'baselines-only' | 'microfrontend' | 'no-match' | 'open'

/** How strongly HyperFrontend fits, when it fits at all. */
export type FitStrength = 'only-option' | 'strong' | 'good' | 'viable' | 'ruled-out'

/** How HyperFrontend fared, and why. */
export interface HyperfrontendVerdict {
  /** True when the family HyperFrontend implements is still a candidate. */
  viable: boolean
  /** How strongly it fits, for headline wording. */
  strength: FitStrength
  /** How many microfrontend approaches survive alongside it. */
  alternatives: number
  /** Answers that actively pointed toward this approach rather than merely permitting it. */
  matchedAnswers: AnsweredQuestion[]
  /** The answer that ruled it out, absent when it survived. */
  ruledOutBy?: Elimination
  /** Requirements the reader's answers conflict with, by floor id. */
  conflicts: string[]
}

/** The evaluated state of an assessment: what survives, what was ruled out, and what to ask next. */
export interface EngineResult {
  /** Families that no answer has eliminated. */
  surviving: Family[]
  /** Families ruled out, each with the answer responsible. */
  eliminated: EliminatedFamily[]
  /** Ids of families an answer favored without eliminating anything. */
  favored: Set<string>
  /**
   * Every elimination that applies to a family, keyed by family id and in dataset
   * order, so the first entry is always the one `eliminated` attributes.
   *
   * A family can be ruled out by up to ten different answers. Reporting only the
   * first match as the cause states a single reason the reader could remove and
   * still find the family gone, so the full list is what makes a near-miss or a
   * tension line truthful.
   */
  alsoEliminatedBy: Map<string, Elimination[]>
  /** Every answered question whose answer favors a family, keyed by family id. */
  favoredBy: Map<string, AnsweredQuestion[]>
  /** Answered questions whose answer neither eliminated nor favored anything. */
  inertAnswers: AnsweredQuestion[]
  /** The questions answered so far, in dataset order. */
  answered: AnsweredQuestion[]
  /** Questions currently relevant, including those already answered. */
  relevant: Question[]
  /** The next relevant unanswered question, or null when none remain. */
  next: Question | null
  /** The outcome class the current answers resolve to. */
  outcome: Outcome
  /** Where hyperfrontend landed and why. */
  hyperfrontend: HyperfrontendVerdict
}

/**
 * Decides whether a question is relevant given the answers so far. A question
 * with no gate is always relevant; a gated one needs at least one of its
 * unlocking answers to have been chosen.
 *
 * @param question - The question to test.
 * @param answers - Selected answer id keyed by question id.
 * @returns True when the question should be put to the reader.
 */
export function isRelevant(question: Question, answers: Record<string, string>): boolean {
  if (!question.unlockedBy || question.unlockedBy.length === 0) return true
  return question.unlockedBy.some((gate) => answers[gate.questionId] === gate.answerId)
}

/**
 * Drops answers whose questions are no longer relevant, repeatedly, until the
 * set is stable.
 *
 * Changing an early answer can close the gate that made a later question
 * relevant. Keeping that stale answer would let a question the reader can no
 * longer see keep eliminating families, so the engine would report a conclusion
 * nothing on screen explains.
 *
 * @param answers - Selected answer id keyed by question id.
 * @returns A pruned copy containing only answers to currently relevant questions.
 * @example
 * ```ts
 * const pruned = pruneAnswers({ ...answers, 'question.deploy.independence': otherAnswerId })
 * ```
 */
export function pruneAnswers(answers: Record<string, string>): Record<string, string> {
  let current = { ...answers }
  for (;;) {
    const kept: Record<string, string> = {}
    for (const question of decisionFramework.questions) {
      const answerId = current[question.id]
      if (answerId && isRelevant(question, current)) kept[question.id] = answerId
    }
    if (keys(kept).length === keys(current).length) return kept
    current = kept
  }
}

/**
 * Runs the decision model over a set of answers. Pure and deterministic: the
 * same answers against the same dataset always produce the same result, with no
 * language model in the loop.
 *
 * @param answers - Selected answer id keyed by question id.
 * @returns Survivors, every elimination with its causes, what the answers favored, and the next relevant question.
 * @example
 * ```ts
 * const result = evaluate({ 'question.deploy.independence': 'question.deploy.independence#train-mandated' })
 * result.outcome // 'baselines-only'
 * ```
 */
export function evaluate(answers: Record<string, string>): EngineResult {
  const { families, questions } = decisionFramework
  const eliminatedBy = createMap<string, Elimination>()
  const alsoEliminatedBy = createMap<string, Elimination[]>()
  const favoredBy = createMap<string, AnsweredQuestion[]>()
  const favored = createSet<string>()
  const answered: AnsweredQuestion[] = []
  const inertAnswers: AnsweredQuestion[] = []

  for (const question of questions) {
    const answerId = answers[question.id]
    if (!answerId) continue
    const answer = question.answers.find((candidate) => candidate.id === answerId)
    if (!answer) continue
    const entry: AnsweredQuestion = { question, answer }
    answered.push(entry)
    for (const familyId of answer.eliminates) {
      const elimination: Elimination = { familyId, questionId: question.id, answerId: answer.id }
      if (!eliminatedBy.has(familyId)) eliminatedBy.set(familyId, elimination)
      const everyCause = alsoEliminatedBy.get(familyId)
      if (everyCause) everyCause.push(elimination)
      else alsoEliminatedBy.set(familyId, [elimination])
    }
    for (const familyId of answer.favors) {
      favored.add(familyId)
      const everyFavor = favoredBy.get(familyId)
      if (everyFavor) everyFavor.push(entry)
      else favoredBy.set(familyId, [entry])
    }
    if (answer.eliminates.length === 0 && answer.favors.length === 0) inertAnswers.push(entry)
  }

  const relevant = questions.filter((question) => isRelevant(question, answers))
  const surviving = families.filter((family) => !eliminatedBy.has(family.id))
  const eliminated: EliminatedFamily[] = families
    .filter((family) => eliminatedBy.has(family.id))
    .map((family) => ({ family, by: <Elimination>eliminatedBy.get(family.id) }))

  const next = relevant.find((question) => !answers[question.id]) ?? null
  const survivingMfe = surviving.filter((family) => family.kind === 'microfrontend')
  const outcome: Outcome =
    surviving.length === 0 ? 'no-match' : answered.length === 0 ? 'open' : survivingMfe.length === 0 ? 'baselines-only' : 'microfrontend'

  const ruledOutBy = eliminatedBy.get(HYPERFRONTEND_FAMILY_ID)
  const chosenAnswerIds = createSet(answered.map(({ answer }) => answer.id))
  const conflicts = decisionFramework.hyperfrontendFloor
    .filter((requirement) => requirement.conflictsWith.some((answerId) => chosenAnswerIds.has(answerId)))
    .map((requirement) => requirement.id)

  const matchedAnswers = answered.filter(({ answer }) => answer.favors.includes(HYPERFRONTEND_FAMILY_ID))
  const alternatives = survivingMfe.filter((family) => family.id !== HYPERFRONTEND_FAMILY_ID).length
  const strength = fitStrengthOf(Boolean(ruledOutBy), alternatives, matchedAnswers.length)

  return {
    surviving,
    eliminated,
    favored,
    alsoEliminatedBy,
    favoredBy,
    inertAnswers,
    answered,
    relevant,
    next,
    outcome,
    hyperfrontend: { viable: !ruledOutBy, strength, alternatives, matchedAnswers, ruledOutBy, conflicts },
  }
}

/**
 * Grades how strongly HyperFrontend fits, from what the answers did rather than
 * from enthusiasm.
 *
 * Being the last approach standing is a stronger statement than surviving
 * alongside six others, and an answer that actively points at this boundary is
 * stronger evidence than one that merely fails to rule it out. Keeping the two
 * apart stops a permissive result being reported as an endorsement.
 *
 * @param ruledOut - Whether an answer eliminated the family.
 * @param alternatives - How many other microfrontend approaches also survive.
 * @param matches - How many answers actively favored this approach.
 * @returns The grade the headline should use.
 * @example
 * ```ts
 * fitStrengthOf(false, 0, 2) // 'only-option'
 * ```
 */
export function fitStrengthOf(ruledOut: boolean, alternatives: number, matches: number): FitStrength {
  if (ruledOut) return 'ruled-out'
  if (alternatives === 0) return 'only-option'
  if (matches >= 2 && alternatives <= 3) return 'strong'
  if (matches >= 1) return 'good'
  return 'viable'
}

/**
 * Counts how many relevant questions remain unanswered, for progress display.
 *
 * @param result - An evaluated result.
 * @returns Answered count and the total questions currently known to be relevant.
 * @example
 * ```ts
 * const { answered, total } = progressOf(evaluate({}))
 * ```
 */
/** How far through the relevant questions the reader has got. */
export interface AssessmentProgress {
  /** Questions answered so far. */
  answered: number
  /** Questions currently known to be relevant, which grows as gated questions unlock. */
  total: number
}

/**
 *
 * @param result
 */
/**
 * Counts how far through the relevant questions the reader has got. The total
 * is a moving target by design: answering one question can unlock others, so
 * progress reflects what is known now rather than a fixed script.
 *
 * @param result - An evaluated result to measure.
 * @returns The answered count and the number of questions currently relevant.
 * @example
 * ```ts
 * const { answered, total } = progressOf(evaluate({}))
 * ```
 */
export function progressOf(result: EngineResult): AssessmentProgress {
  return { answered: result.answered.length, total: max(result.relevant.length, result.answered.length) }
}

/**
 * Reads a saved assessment from local storage, tolerating absence, disabled
 * storage, and stale shapes.
 *
 * @returns The stored assessment, or null when nothing usable is saved.
 */
export function loadAssessment(): StoredAssessment | null {
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY)
    if (!raw) return null
    const stored = <StoredAssessment>parse(raw)
    if (!stored || typeof stored !== 'object' || !stored.answers) return null
    return stored
  } catch {
    return null
  }
}

/**
 * Writes the assessment to local storage. Failure is silent by design: a reader
 * with storage disabled still gets a working assessment for the session.
 *
 * @param label - The reader's local label for the assessment.
 * @param answers - Selected answer id keyed by question id.
 */
export function saveAssessment(label: string, answers: Record<string, string>): void {
  try {
    const payload: StoredAssessment = {
      version: decisionFramework.metadata.frameworkVersion,
      researchSnapshot: decisionFramework.metadata.researchSnapshot,
      savedAt: createDate().toISOString(),
      label,
      answers,
    }
    window.localStorage.setItem(ASSESSMENT_STORAGE_KEY, stringify(payload))
  } catch {
    // Storage refused the write. The assessment stays in memory for this session.
  }
}

/**
 * Removes the saved assessment from local storage.
 */
export function clearAssessment(): void {
  try {
    window.localStorage.removeItem(ASSESSMENT_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
