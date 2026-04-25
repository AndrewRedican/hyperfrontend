import type { Step } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createTestConfig } from '../__test-utils__/base-config'
import { SessionStatus } from '../models/session-outcome'
import { cancelled, done, goto } from '../models/step'
import { runAuthorSession } from './run-session'

describe('runAuthorSession', () => {
  it('returns committed with the formatted message after every step succeeds', async () => {
    const steps: Step[] = [
      {
        id: 'seed',
        async run(ctx) {
          ctx.draft = { type: 'feat', subject: 'hi' }
          return done()
        },
      },
    ]

    const outcome = await runAuthorSession({ steps, config: createTestConfig() })

    expect(outcome).toEqual({ status: SessionStatus.Committed, message: 'feat: hi' })
  })

  it('bails out as cancelled when a step returns cancelled', async () => {
    const boom = createError('boom')
    const steps: Step[] = [
      {
        id: 'fail',
        async run() {
          return cancelled(boom)
        },
      },
    ]

    const outcome = await runAuthorSession({ steps, config: createTestConfig() })

    expect(outcome).toEqual({ status: SessionStatus.Cancelled, error: boom })
  })

  it('returns a bare cancelled outcome when no error is attached', async () => {
    const steps: Step[] = [
      {
        id: 'fail',
        async run() {
          return cancelled()
        },
      },
    ]

    const outcome = await runAuthorSession({ steps, config: createTestConfig() })

    expect(outcome).toEqual({ status: SessionStatus.Cancelled })
  })

  it('follows goto jumps to the targeted step and skips steps in between', async () => {
    const visits: string[] = []
    const steps: Step[] = [
      {
        id: 'seed',
        async run(ctx) {
          visits.push('seed')
          ctx.draft = { type: 'feat', subject: 'jumped' }
          return goto('finalize')
        },
      },
      {
        id: 'skipped',
        async run() {
          visits.push('skipped')
          return done()
        },
      },
      {
        id: 'finalize',
        async run() {
          visits.push('finalize')
          return done()
        },
      },
    ]

    await runAuthorSession({ steps, config: createTestConfig() })

    expect(visits).toEqual(['seed', 'finalize'])
  })

  it('cancels when a goto target does not exist', async () => {
    const steps: Step[] = [
      {
        id: 'only',
        async run() {
          return goto('missing')
        },
      },
    ]

    const outcome = await runAuthorSession({ steps, config: createTestConfig() })

    expect(outcome).toEqual(
      expect.objectContaining({
        status: SessionStatus.Cancelled,
        error: expect.objectContaining({ message: 'Unknown goto target: missing' }),
      })
    )
  })
})
