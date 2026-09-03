import { describe, expect, it } from '@hyperfrontend/testing'
import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { typeStep } from './type'

describe('typeStep', () => {
  it('writes the selected type into the draft on submit', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = typeStep.run(ctx)
    term.input.enqueueKeys([TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.type).toBe('feat')
    term.destroy()
  })

  it('seeds the cursor from the existing draft type on restart', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'fix' }

    const pending = typeStep.run(ctx)
    term.input.enqueueKeys([TestKey.Enter])
    await pending

    expect(ctx.draft.type).toBe('fix')
    term.destroy()
  })

  it('returns cancelled when the user hits Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = typeStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })
})
