import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { previewStep, PREVIEW_RESTART_STEP_ID } from './preview'

describe('previewStep', () => {
  it('returns done when the user accepts the draft', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys(['y'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('jumps back to the type step when the user rejects the draft', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys(['n'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Goto, gotoStepId: PREVIEW_RESTART_STEP_ID })
    term.destroy()
  })

  it('returns cancelled on Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('prints validation warnings before the confirm prompt', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat', subject: 'added login' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys(['y'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('surfaces validation errors from an unknown commit type', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'banana' as 'feat', subject: 'x' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys(['y'])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('writes the preview message and warnings directly to the output stream', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat', subject: 'added login' }

    const pending = previewStep.run(ctx)
    term.input.enqueueKeys(['y'])
    await pending

    const data = term.output.getWrittenData()

    // why: preview must reach stdout regardless of logger level so the user sees what's being committed
    expect(data).toContain('feat: added login')
    expect(data).toContain('warn(imperative-mood):')

    term.destroy()
  })
})
