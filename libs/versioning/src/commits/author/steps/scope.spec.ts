import { describe, expect, it } from '@hyperfrontend/testing'
import { Keys } from '@hyperfrontend/testing/process'
import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { NO_SCOPE_CANDIDATES_MESSAGE, scopeStep } from './scope'

describe('scopeStep', () => {
  it('cancels with a helpful error when no candidates exist and scope is required', async () => {
    const ctx = createSessionContext(createTestConfig())
    const result = await scopeStep.run(ctx)
    expect(result).toEqual(
      expect.objectContaining({
        status: StepStatus.Cancelled,
        error: expect.objectContaining({ message: NO_SCOPE_CANDIDATES_MESSAGE }),
      })
    )
  })

  it('proceeds when scope is optional with no candidates', async () => {
    const ctx = createSessionContext(createTestConfig({ scopeOptional: true }))
    const result = await scopeStep.run(ctx)
    expect(result).toEqual({ status: StepStatus.Done })
  })

  it('writes an empty scope when scope is optional with no candidates', async () => {
    const ctx = createSessionContext(createTestConfig({ scopeOptional: true }))
    await scopeStep.run(ctx)
    expect(ctx.draft.scope).toEqual([])
  })

  it('submits the single selected scope into the draft', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.candidateScopes = ['alpha', 'beta']
    ctx.defaultScope = 'alpha'

    const pending = scopeStep.run(ctx)
    await term.input.sendKeys(Keys.Enter)
    await pending

    expect(ctx.draft.scope).toEqual(['alpha'])
    term.destroy()
  })

  it('seeds cursor to existing draft scope on preview restart', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.candidateScopes = ['alpha', 'beta']
    ctx.defaultScope = 'alpha'
    ctx.draft = { scope: ['beta'] }

    const pending = scopeStep.run(ctx)
    await term.input.sendKeys(Keys.Enter)
    await pending

    expect(ctx.draft.scope).toEqual(['beta'])
    term.destroy()
  })

  it('returns cancelled when the user hits Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.candidateScopes = ['alpha']

    const pending = scopeStep.run(ctx)
    await term.input.sendKeys(Keys.CtrlC)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('uses multiselect when scopeMulti is enabled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output, scopeMulti: true }))
    ctx.candidateScopes = ['alpha', 'beta']

    const pending = scopeStep.run(ctx)
    await term.input.sendKeys(Keys.Space, Keys.Enter)
    await pending

    expect(ctx.draft.scope).toEqual(['alpha'])
    term.destroy()
  })

  it('cancels when multiselect is cancelled', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output, scopeMulti: true }))
    ctx.candidateScopes = ['alpha']

    const pending = scopeStep.run(ctx)
    await term.input.sendKeys(Keys.CtrlC)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })
})
