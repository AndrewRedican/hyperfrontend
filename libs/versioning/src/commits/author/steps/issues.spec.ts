import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
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
})

describe('issuesStep', () => {
  it('drops the step without touching footers when user says no', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['n'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.footers).toBeUndefined()
    term.destroy()
  })

  it('appends parsed references as issue footers on yes', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['y', 'f', 'i', 'x', 'e', 's', ' ', '#', '1', '2', TestKey.Enter])
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Fixes', value: '12', separator: ' #' }])
    term.destroy()
  })

  it('returns cancelled when the confirm prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('returns cancelled when the text prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['y', TestKey.CtrlC])
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
    term.input.enqueueKeys(['n'])
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'BREAKING CHANGE', value: 'x', separator: ':' }])
    term.destroy()
  })

  it('drops the footers field entirely when removing the only issue footer', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Fixes', value: '1', separator: ' #' }] }

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['n'])
    await pending

    expect(ctx.draft.footers).toBeUndefined()
    term.destroy()
  })

  it('leaves the draft untouched on "no" when there were never any issue footers', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Note', value: 'x', separator: ':' }] }

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['n'])
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Note', value: 'x', separator: ':' }])
    term.destroy()
  })

  it('replaces existing issue footers with newly entered references', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { footers: [{ key: 'Fixes', value: '1', separator: ' #' }] }

    const pending = issuesStep.run(ctx)
    term.input.enqueueKeys(['y', 'r', 'e', ' ', '#', '9', TestKey.Enter])
    await pending

    expect(ctx.draft.footers).toEqual([{ key: 'Re', value: '9', separator: ' #' }])
    term.destroy()
  })
})
