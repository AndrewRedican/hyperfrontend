import { waitForShutdown } from './shutdown'

describe('waitForShutdown', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('resolves when a termination signal handler fires', async () => {
    jest.spyOn(process, 'once').mockImplementation(<typeof process.once>((_event: string, listener: () => void) => {
      listener()
      return process
    }))
    await expect(waitForShutdown()).resolves.toBeUndefined()
  })
})
