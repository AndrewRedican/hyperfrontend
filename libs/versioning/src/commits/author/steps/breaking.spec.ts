import { describe, expect, it } from '@hyperfrontend/testing'
import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { breakingStep } from './breaking'

describe('breakingStep', () => {
  it('records breaking: false when user says no', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys(['n'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.breaking).toBe(false)
    term.destroy()
  })

  it('collects breaking description and sets breaking: true on yes', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys(['y', 'A', 'P', 'I', TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft).toEqual(expect.objectContaining({ breaking: true, breakingDescription: 'API' }))
    term.destroy()
  })

  it('returns cancelled when the confirm prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('returns cancelled when the description prompt is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys(['y', TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('strips a leftover BREAKING CHANGE footer when user flips to no on restart', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = {
      breaking: true,
      breakingDescription: 'old',
      footers: [
        { key: 'BREAKING CHANGE', value: 'old', separator: ':' },
        { key: 'Refs', value: '#1', separator: ':' },
      ],
    }

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys(['n'])
    await pending

    expect(ctx.draft).toEqual(
      expect.objectContaining({
        breaking: false,
        footers: [{ key: 'Refs', value: '#1', separator: ':' }],
      })
    )
    term.destroy()
  })

  it('drops the footers field entirely when removing the only BREAKING footer', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = {
      breaking: true,
      breakingDescription: 'old',
      footers: [{ key: 'BREAKING CHANGE', value: 'old', separator: ':' }],
    }

    const pending = breakingStep.run(ctx)
    term.input.enqueueKeys(['n'])
    await pending

    expect(ctx.draft.footers).toBeUndefined()
    term.destroy()
  })
})
