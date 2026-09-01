import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { waitForShutdown } from './shutdown'

describe('waitForShutdown', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('resolves when a termination signal handler fires', async () => {
    jest.spyOn(process, 'once').mockImplementation(((_event: string, listener: () => void) => {
      listener()
      return process
    }) as typeof process.once)
    await expect(waitForShutdown()).resolves.toBeUndefined()
  })
})
