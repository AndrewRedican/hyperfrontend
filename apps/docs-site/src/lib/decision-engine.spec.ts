import type { Answer, Question, QuestionUnlock } from '../data/decision-framework'
import type { Elimination } from './decision-engine'
import { describe, expect, it } from 'vitest'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { decisionFramework } from '../data/decision-framework'
import { evaluate, HYPERFRONTEND_FAMILY_ID, isRelevant, progressOf, pruneAnswers } from './decision-engine'

/**
 * Narrows a dataset lookup a test depends on, failing with a message that names what is
 * missing instead of letting an absent value surface as a downstream type error.
 *
 * @param value - The looked-up value.
 * @param what - Names what the lookup was for.
 * @returns The value, never null or undefined.
 */
function mustFind<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`the dataset has no ${what}`)
  return value
}

/**
 * Picks the first answer of a question that eliminates at least one family, so
 * a test can drive the engine without hard-coding ids that the dataset may
 * legitimately renumber between research snapshots.
 *
 * @param predicate - Narrows which eliminating answer is wanted.
 * @returns The question id and answer id, or null when the dataset has none.
 */
function findEliminatingAnswer(predicate: (familyIds: string[]) => boolean): { questionId: string; answerId: string } | null {
  for (const question of decisionFramework.questions) {
    for (const answer of question.answers) {
      if (answer.eliminates.length > 0 && predicate(answer.eliminates)) return { questionId: question.id, answerId: answer.id }
    }
  }
  return null
}

/**
 * Finds the first question the dataset asks unconditionally.
 *
 * @returns The question, or undefined when every question is gated.
 */
function findUngatedQuestion(): Question | undefined {
  return decisionFramework.questions.find((question) => !question.unlockedBy?.length)
}

/**
 * Finds the first question the dataset hides behind a gate, along with the gate that
 * reveals it, so a test can exercise gating without naming ids the research may renumber.
 *
 * @returns The question and its first gate, or undefined when no question is gated.
 */
function findGatedQuestion(): { question: Question; gate: QuestionUnlock } | undefined {
  for (const question of decisionFramework.questions) {
    const gate = question.unlockedBy?.[0]
    if (gate) return { question, gate }
  }
  return undefined
}

const MICROFRONTEND_FAMILIES = decisionFramework.families.filter((family) => family.kind === 'microfrontend').map((family) => family.id)

/**
 * Answers every ungated question with whichever of its answers scores highest, so a
 * test can build a dense answer set from what the dataset actually contains rather
 * than from ids a research pass may renumber. Ties keep the first answer, which makes
 * the selection deterministic.
 *
 * @param score - Ranks one answer of a question against its siblings.
 * @returns Selected answer id keyed by question id.
 */
function answerEveryUngatedQuestion(score: (answer: Answer, question: Question) => number): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const question of decisionFramework.questions) {
    if (question.unlockedBy?.length) continue
    let chosen = question.answers[0]
    for (const answer of question.answers) if (score(answer, question) > score(chosen, question)) chosen = answer
    answers[question.id] = chosen.id
  }
  return answers
}

/**
 * Rebuilds, straight from the dataset, every elimination of one family that a set of
 * answers justifies, in the order the engine walks the questions.
 *
 * @param familyId - The family to collect causes for.
 * @param answers - Selected answer id keyed by question id.
 * @returns Every elimination that applies, in dataset order.
 */
function everyCauseFor(familyId: string, answers: Record<string, string>): Elimination[] {
  const causes: Elimination[] = []
  for (const question of decisionFramework.questions) {
    const answer = question.answers.find((candidate) => candidate.id === answers[question.id])
    if (answer?.eliminates.includes(familyId)) causes.push({ familyId, questionId: question.id, answerId: answer.id })
  }
  return causes
}

describe('evaluate', () => {
  it('starts with every approach viable', () => {
    const result = evaluate({})

    expect({ surviving: result.surviving.length, eliminated: result.eliminated.length }).toEqual({
      surviving: decisionFramework.families.length,
      eliminated: 0,
    })
  })

  it('starts with nothing decided and a question to ask', () => {
    const result = evaluate({})

    expect({ outcome: result.outcome, next: result.next }).toEqual({ outcome: 'open', next: expect.anything() })
  })

  it('is deterministic: the same answers always produce the same eliminations and outcome', () => {
    const chosen = mustFind(
      findEliminatingAnswer(() => true),
      'eliminating answer'
    )
    const answers = { [chosen.questionId]: chosen.answerId }

    const first = evaluate(answers)
    const second = evaluate(answers)

    expect({ eliminated: second.eliminated.map((entry) => entry.family.id), outcome: second.outcome }).toEqual({
      eliminated: first.eliminated.map((entry) => entry.family.id),
      outcome: first.outcome,
    })
  })

  it('rules out at least one family for an eliminating answer', () => {
    const chosen = mustFind(
      findEliminatingAnswer(() => true),
      'eliminating answer'
    )
    const result = evaluate({ [chosen.questionId]: chosen.answerId })

    expect(result.eliminated.length).toBeGreaterThan(0)
  })

  it('attributes every elimination to the answer responsible', () => {
    const chosen = mustFind(
      findEliminatingAnswer(() => true),
      'eliminating answer'
    )
    const result = evaluate({ [chosen.questionId]: chosen.answerId })

    for (const entry of result.eliminated) {
      expect(entry.by).toMatchObject({ questionId: chosen.questionId, answerId: chosen.answerId })
    }
  })

  it('ignores an answer id the dataset no longer contains', () => {
    const question = decisionFramework.questions[0]

    const result = evaluate({ [question.id]: 'question.removed#gone' })

    expect({ answered: result.answered, eliminated: result.eliminated }).toStrictEqual({ answered: [], eliminated: [] })
  })

  it('reports the no-microfrontends outcome when only baselines survive', () => {
    const killsEveryMicrofrontend = mustFind(
      findEliminatingAnswer((familyIds) => MICROFRONTEND_FAMILIES.every((familyId) => familyIds.includes(familyId))),
      'answer that eliminates every microfrontend family'
    )

    const result = evaluate({ [killsEveryMicrofrontend.questionId]: killsEveryMicrofrontend.answerId })

    expect({
      outcome: result.outcome,
      nonBaselineSurvivors: result.surviving.filter((family) => family.kind !== 'baseline'),
    }).toStrictEqual({ outcome: 'baselines-only', nonBaselineSurvivors: [] })
  })

  it('records how hyperfrontend fared and what ruled it out', () => {
    const kills = mustFind(
      findEliminatingAnswer((familyIds) => familyIds.includes(HYPERFRONTEND_FAMILY_ID)),
      'answer that eliminates hyperfrontend'
    )

    const result = evaluate({ [kills.questionId]: kills.answerId })

    expect(result.hyperfrontend).toMatchObject({ viable: false, ruledOutBy: { answerId: kills.answerId } })
  })

  it('leaves hyperfrontend viable when no answer eliminates its family', () => {
    const result = evaluate({})

    expect({ viable: result.hyperfrontend.viable, ruledOutBy: result.hyperfrontend.ruledOutBy }).toStrictEqual({
      viable: true,
      ruledOutBy: undefined,
    })
  })
})

describe('alsoEliminatedBy', () => {
  it('rules families out when every question takes its most eliminating answer', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    expect(result.eliminated.length).toBeGreaterThan(0)
  })

  it('reports every elimination, not only the one the result attributes', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    for (const entry of result.eliminated) {
      const causes = result.alsoEliminatedBy.get(entry.family.id) ?? []

      expect(causes).toEqual(everyCauseFor(entry.family.id, answers))
    }
  })

  it('lists first the elimination the result attributes', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    for (const entry of result.eliminated) {
      const causes = result.alsoEliminatedBy.get(entry.family.id) ?? []

      expect(causes[0]).toEqual(entry.by)
    }
  })

  it('reports more than one cause for a family that several answers ruled out', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    const withMoreThanOneCause = result.eliminated.filter((entry) => (result.alsoEliminatedBy.get(entry.family.id) ?? []).length > 1)

    expect(withMoreThanOneCause.length).toBeGreaterThan(0)
  })

  it('is keyed by exactly the families that were ruled out', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    expect([...result.alsoEliminatedBy.keys()].sort()).toEqual(result.eliminated.map((entry) => entry.family.id).sort())
  })

  it('holds no entry for a family that survived', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.eliminates.length)
    const result = evaluate(answers)

    for (const family of result.surviving) expect(result.alsoEliminatedBy.has(family.id)).toBe(false)
  })

  it('holds nothing while no answer has ruled anything out', () => {
    expect(evaluate({}).alsoEliminatedBy.size).toBe(0)
  })
})

describe('favoredBy', () => {
  it('favors families when every question takes its most favoring answer', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.favors.length)
    const result = evaluate(answers)

    expect(result.favored.size).toBeGreaterThan(0)
  })

  it('is keyed by exactly the families the answers favored', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.favors.length)
    const result = evaluate(answers)

    expect([...result.favoredBy.keys()].sort()).toEqual([...result.favored].sort())
  })

  it('lists every answered question whose answer favors the family', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.favors.length)
    const result = evaluate(answers)

    for (const [familyId, entries] of result.favoredBy) {
      const expected = result.answered.filter(({ answer }) => answer.favors.includes(familyId))
      expect(entries.map(({ answer }) => answer.id)).toEqual(expected.map(({ answer }) => answer.id))
    }
  })

  it('pairs every favoring answer with the question that offers it', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.favors.length)
    const result = evaluate(answers)

    for (const entries of result.favoredBy.values()) {
      for (const entry of entries) expect(entry.question.answers).toContain(entry.answer)
    }
  })

  it('records a favor for every family an answered answer names', () => {
    const answers = answerEveryUngatedQuestion((answer) => answer.favors.length)
    const result = evaluate(answers)

    for (const { answer } of result.answered) {
      for (const familyId of answer.favors) {
        expect(result.favoredBy.get(familyId)?.some((entry) => entry.answer.id === answer.id)).toBe(true)
      }
    }
  })

  it('holds nothing while no question has been answered', () => {
    expect(evaluate({}).favoredBy.size).toBe(0)
  })
})

describe('inertAnswers', () => {
  it('collects inert answers when every question takes one where it can', () => {
    const answers = answerEveryUngatedQuestion((answer) => (answer.eliminates.length === 0 && answer.favors.length === 0 ? 1 : 0))
    const result = evaluate(answers)

    expect(result.inertAnswers.length).toBeGreaterThan(0)
  })

  it('collects only answers that neither eliminated nor favored anything', () => {
    const answers = answerEveryUngatedQuestion((answer) => (answer.eliminates.length === 0 && answer.favors.length === 0 ? 1 : 0))
    const result = evaluate(answers)

    for (const entry of result.inertAnswers) {
      expect(entry.answer).toMatchObject({ eliminates: [], favors: [] })
    }
  })

  it('never collects an answer that ruled a family out', () => {
    const answers = answerEveryUngatedQuestion((answer) => (answer.eliminates.length === 0 && answer.favors.length === 0 ? 1 : 0))
    const result = evaluate(answers)

    const inertAnswerIds = createSet(result.inertAnswers.map(({ answer }) => answer.id))
    for (const entry of result.eliminated) expect(inertAnswerIds.has(entry.by.answerId)).toBe(false)
  })

  it('never collects an answer that favored a family', () => {
    const answers = answerEveryUngatedQuestion((answer) => (answer.eliminates.length === 0 && answer.favors.length === 0 ? 1 : 0))
    const result = evaluate(answers)

    const inertAnswerIds = createSet(result.inertAnswers.map(({ answer }) => answer.id))
    for (const entries of result.favoredBy.values()) {
      for (const entry of entries) expect(inertAnswerIds.has(entry.answer.id)).toBe(false)
    }
  })

  it('excludes an answer that ruled a family out', () => {
    const chosen = mustFind(
      findEliminatingAnswer(() => true),
      'eliminating answer'
    )
    const result = evaluate({ [chosen.questionId]: chosen.answerId })

    expect(result.inertAnswers).toHaveLength(0)
  })

  it('holds nothing while no question has been answered', () => {
    expect(evaluate({}).inertAnswers).toHaveLength(0)
  })
})

describe('isRelevant', () => {
  it('treats an ungated question as always relevant', () => {
    const ungated = mustFind(findUngatedQuestion(), 'ungated question')

    expect(isRelevant(ungated, {})).toBe(true)
  })

  it('hides a gated question while none of its unlocking answers is chosen', () => {
    const { question: gated } = mustFind(findGatedQuestion(), 'gated question')

    expect(isRelevant(gated, {})).toBe(false)
  })

  it('reveals a gated question once one of its unlocking answers is chosen', () => {
    const { question: gated, gate } = mustFind(findGatedQuestion(), 'gated question')

    expect(isRelevant(gated, { [gate.questionId]: gate.answerId })).toBe(true)
  })
})

describe('pruneAnswers', () => {
  it('keeps answers whose questions are still relevant', () => {
    const ungated = mustFind(findUngatedQuestion(), 'ungated question')
    const answers = { [ungated.id]: ungated.answers[0].id }

    expect(pruneAnswers(answers)).toEqual(answers)
  })

  it('keeps an answer to a gated question while the gate that revealed it is open', () => {
    const { question: gated, gate } = mustFind(findGatedQuestion(), 'gated question')

    const withGateOpen = { [gate.questionId]: gate.answerId, [gated.id]: gated.answers[0].id }
    expect(pruneAnswers(withGateOpen)[gated.id]).toBe(gated.answers[0].id)
  })

  it('drops an answer once the gate that revealed its question closes', () => {
    const { question: gated, gate } = mustFind(findGatedQuestion(), 'gated question')
    const gateQuestion = mustFind(
      decisionFramework.questions.find((question) => question.id === gate.questionId),
      `question ${gate.questionId}`
    )
    const otherAnswer = mustFind(
      gateQuestion.answers.find((answer) => answer.id !== gate.answerId),
      `second answer to ${gateQuestion.id}`
    )

    const withGateOpen = { [gate.questionId]: gate.answerId, [gated.id]: gated.answers[0].id }
    const withGateClosed = { ...withGateOpen, [gate.questionId]: otherAnswer.id }
    expect(pruneAnswers(withGateClosed)[gated.id]).toBeUndefined()
  })

  it('discards an answer to a question the dataset no longer has', () => {
    expect(pruneAnswers({ 'question.retired': 'question.retired#answer' })).toEqual({})
  })
})

describe('progressOf', () => {
  it('counts the questions answered so far', () => {
    const ungated = mustFind(findUngatedQuestion(), 'ungated question')

    const progress = progressOf(evaluate({ [ungated.id]: ungated.answers[0].id }))

    expect(progress.answered).toBe(1)
  })

  it('counts at least as many relevant questions as answered ones', () => {
    const ungated = mustFind(findUngatedQuestion(), 'ungated question')

    const progress = progressOf(evaluate({ [ungated.id]: ungated.answers[0].id }))

    expect(progress.total).toBeGreaterThanOrEqual(progress.answered)
  })
})

describe('dataset integrity', () => {
  it('only ever eliminates families that exist', () => {
    const familyIds = new Set(decisionFramework.families.map((family) => family.id))

    for (const question of decisionFramework.questions) {
      for (const answer of question.answers) {
        for (const familyId of [...answer.eliminates, ...answer.favors]) {
          expect(familyIds.has(familyId), `${answer.id} references ${familyId}`).toBe(true)
        }
      }
    }
  })

  it('gates every conditional question on an answer that exists', () => {
    for (const question of decisionFramework.questions) {
      for (const gate of question.unlockedBy ?? []) {
        const source = decisionFramework.questions.find((candidate) => candidate.id === gate.questionId)
        // note: an unknown gate question leaves `source` undefined, which fails this check too, so the message names both cases
        expect(
          source?.answers.some((answer) => answer.id === gate.answerId),
          `${question.id} gated by unknown ${gate.questionId} or its unknown answer ${gate.answerId}`
        ).toBe(true)
      }
    }
  })

  it('maps every implementation onto at least one family', () => {
    for (const implementation of decisionFramework.implementations) {
      expect(implementation.families.length, `${implementation.id} maps onto no family`).toBeGreaterThan(0)
    }
  })

  it('maps every implementation onto a known family', () => {
    const familyIds = new Set(decisionFramework.families.map((family) => family.id))

    for (const implementation of decisionFramework.implementations) {
      for (const familyId of implementation.families) {
        expect(familyIds.has(familyId), `${implementation.id} references ${familyId}`).toBe(true)
      }
    }
  })

  it('lists at least one planned capability', () => {
    const planned = decisionFramework.implementations.filter((implementation) => implementation.availability === 'announced-planned')

    expect(planned.length).toBeGreaterThan(0)
  })

  it('never presents a planned capability as available', () => {
    const planned = decisionFramework.implementations.filter((implementation) => implementation.availability === 'announced-planned')

    for (const implementation of planned) {
      expect(implementation.availability).not.toBe('available')
    }
  })
})
