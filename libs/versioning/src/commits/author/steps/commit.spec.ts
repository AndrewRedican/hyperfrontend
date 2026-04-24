import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { commit as gitCommit } from '../../../git/operations/commit'
import { createTestConfig } from '../__test-utils__/base-config'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { commitStep } from './commit'

jest.mock('../../../git/operations/commit', () => ({
  commit: jest.fn(),
}))

const mockedGitCommit = jest.mocked(gitCommit)

beforeEach(() => {
  mockedGitCommit.mockReset()
})

describe('commitStep', () => {
  it('short-circuits as done when skipCommit is true', async () => {
    const ctx = createSessionContext(createTestConfig({ skipCommit: true }))
    ctx.draft = { type: 'feat', subject: 'hi' }
    const result = await commitStep.run(ctx)
    expect(result).toEqual({ status: StepStatus.Done })
  })

  it('hands the formatted message to the configured commit executor', async () => {
    const executor = jest.fn<void, [string]>()
    const ctx = createSessionContext(createTestConfig({ skipCommit: false, commitExecutor: executor }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const result = await commitStep.run(ctx)

    expect(result).toEqual({ status: StepStatus.Done })
    expect(executor).toHaveBeenCalledWith('feat: hi')
  })

  it('returns cancelled with the thrown error when the executor fails', async () => {
    const boom = createError('boom')
    const executor = jest.fn<void, [string]>(() => {
      throw boom
    })
    const ctx = createSessionContext(createTestConfig({ skipCommit: false, commitExecutor: executor }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const result = await commitStep.run(ctx)

    expect(result).toEqual({ status: StepStatus.Cancelled, error: boom })
  })

  it('wraps non-Error throws into an Error before cancelling', async () => {
    const executor = jest.fn<void, [string]>(() => {
      throw 'not-an-error'
    })
    const ctx = createSessionContext(createTestConfig({ skipCommit: false, commitExecutor: executor }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const result = await commitStep.run(ctx)

    expect(result).toEqual({
      status: StepStatus.Cancelled,
      error: expect.objectContaining({ message: 'not-an-error' }),
    })
  })

  it('falls back to git commit when no executor is configured', async () => {
    const ctx = createSessionContext(createTestConfig({ cwd: '/repo', skipCommit: false }))
    ctx.draft = { type: 'feat', subject: 'hi' }

    const result = await commitStep.run(ctx)

    expect(result).toEqual({ status: StepStatus.Done })
    expect(mockedGitCommit).toHaveBeenCalledWith('feat: hi', { cwd: '/repo' })
  })
})
