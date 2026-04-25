import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { bodyStep } from './body'

describe('bodyStep', () => {
  it('leaves body undefined when user submits empty input', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = bodyStep.run(ctx)
    term.input.enqueueKeys([TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.body).toBeUndefined()
    term.destroy()
  })

  it('writes trimmed non-empty input into draft.body', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = bodyStep.run(ctx)
    term.input.enqueueKeys(['a', 'b', TestKey.Enter])
    await pending

    expect(ctx.draft.body).toBe('ab')
    term.destroy()
  })

  it('returns cancelled on Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = bodyStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })
})
