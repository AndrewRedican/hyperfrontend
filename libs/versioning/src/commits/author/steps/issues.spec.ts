import { describe, expect, it } from '@hyperfrontend/testing'
import { Keys } from '@hyperfrontend/testing/process'
import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { issuesStep, parseReferences } from './issues'

describe('parseReferences', () => {
  it('extracts keyword/number pairs from a comma-separated list', () => {
    expect(parseReferences('fixes #123, re #456')).toEqual([
      { key: 'Fixes', value: '123', separator: ' #' },
      { key: 'Re', value: '456', separator: ' #' },
    ])
  })

  it('returns an empty array when no references are found', () => {
    expect(parseReferences('nothing here')).toEqual([])
  })

  it('returns no references for long letter-only input', () => {
    const huge = 'A'.repeat(200_000)
    expect(parseReferences(huge)).toEqual([])
  })

  it('handles long letter-only input in linear time without backtracking', () => {
    // why: guards against polynomial-time backtracking on long letter-only inputs
    const huge = 'A'.repeat(200_000)
    const start = Date.now()
    parseReferences(huge)
    const elapsedMs = Date.now() - start

    expect(elapsedMs).toBeLessThan(200)
  })

  it('extracts hyphenated keywords and ignores junk between references', () => {
    expect(parseReferences('co-fixes #1 ;; ?? closes#2 garbage123 resolves   #3')).toEqual([
      { key: 'Co-fixes', value: '1', separator: ' #' },
      { key: 'Closes', value: '2', separator: ' #' },
      { key: 'Resolves', value: '3', separator: ' #' },
    ])
  })
})

describe('issuesStep', () => {
  it('completes the step when user says no', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('n')
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('leaves footers untouched when user says no', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('n')
    await pending

    expect(ctx.draft.footers).toBeUndefined()
    term.destroy()
  })

  it('appends parsed references as issue footers on yes', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('y', 'f', 'i', 'x', 'e', 's', ' ', '#', '1', '2', Keys.Enter)
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Fixes', value: '12', separator: ' #' }])
    term.destroy()
  })

  it('returns cancelled when the confirm prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys(Keys.CtrlC)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('returns cancelled when the text prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('y', Keys.CtrlC)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('preserves colon-separated footers when user says no', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = {
      footers: [
        { key: 'BREAKING CHANGE', value: 'x', separator: ':' },
        { key: 'Fixes', value: '1', separator: ' #' },
      ],
    }

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('n')
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'BREAKING CHANGE', value: 'x', separator: ':' }])
    term.destroy()
  })

  it('drops the footers field entirely when removing the only issue footer', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Fixes', value: '1', separator: ' #' }] }

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('n')
    await pending

    expect(ctx.draft.footers).toBeUndefined()
    term.destroy()
  })

  it('leaves the draft untouched on "no" when there were never any issue footers', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Note', value: 'x', separator: ':' }] }

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('n')
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Note', value: 'x', separator: ':' }])
    term.destroy()
  })

  it('replaces existing issue footers with newly entered references', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Fixes', value: '1', separator: ' #' }] }

    const pending = issuesStep.run(ctx)
    await term.input.sendKeys('y', 'r', 'e', ' ', '#', '9', Keys.Enter)
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Re', value: '9', separator: ' #' }])
    term.destroy()
  })
})
