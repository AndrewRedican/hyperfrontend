import { LifecycleAwareComponent } from './lifecycle-aware-component'
import type { Process } from './lifecycle-aware-component.model'

describe('LifecycleAwareComponent', () => {
  interface Config {
    init: 'success' | 'fail'
    start: 'success' | 'fail'
    stop: 'success' | 'fail'
  }
  const config: Config = {
    init: 'success',
    start: 'success',
    stop: 'success',
  }

  function runAsyncProcess(name: keyof typeof config): Promise<void> {
    return new Promise((resolve, reject) => setTimeout(config[name] === 'success' ? resolve : reject, 200 /* milliseconds */))
  }

  function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
  }

  class AsyncProcess extends LifecycleAwareComponent {
    readonly init: Process = async () => {
      if (this.ready) {
        return 'skipped'
      }
      this.setInitializing(true)
      try {
        await runAsyncProcess('init')
      } catch {
        this.setInitializing(false)
        return 'fail'
      }
      this.setReady(true)
      this.setInitializing(false)
      return 'success'
    }

    readonly start: Process = async () => {
      if (!this.ready || this.starting || this.active) return 'skipped'
      this.setStarting(true)
      try {
        this.setActive(true)
        await runAsyncProcess('start')
        this.setStarting(false)
      } catch {
        this.setActive(false)
        this.setStarting(false)
        return 'fail'
      }
      return 'success'
    }

    readonly stop: Process = async () => {
      if (!this.active || this.stopping) return 'skipped'
      this.setStopping(true)
      try {
        await runAsyncProcess('stop')
        this.setStopping(false)
      } catch {
        this.setStopping(false)
        return 'fail'
      }
      return 'success'
    }
  }

  let asyncProcess: AsyncProcess
  let callback: jest.Func

  beforeEach(() => {
    asyncProcess = new AsyncProcess()
    callback = jest.fn()
  })

  it(`creates an instance successfully`, () => {
    expect(asyncProcess).toBeInstanceOf(AsyncProcess)
  })

  it(`init returns a process status value ('success')`, async () => {
    expect(await asyncProcess.init()).toBe('success')
  })

  // eslint-disable-next-line jest/no-done-callback
  it(`invokes onInitStatusChange callback function when initializing status changes`, (done) => {
    asyncProcess.onInitializingStatusChange(callback)
    sleep(100).then(() => {
      // as it is initializing
      expect(asyncProcess.initializing).toBe(true)
      expect(callback).toHaveBeenNthCalledWith(1, true)
    })
    asyncProcess.init().then(() => {
      // after its done initializing
      expect(asyncProcess.initializing).toBe(false)
      expect(callback).toHaveBeenNthCalledWith(2, false)
      done()
    })
  })

  it(`invokes onStatusReadyChange callback function after initializing`, async () => {
    asyncProcess.onReadyStatusChange(callback)
    await asyncProcess.init()
    expect(callback).toHaveBeenNthCalledWith(1, true)
  })

  // eslint-disable-next-line jest/no-done-callback
  it(`invokes onStartStatusChange callback function after starting`, (done) => {
    asyncProcess.onStartStatusChange(callback)
    asyncProcess.init().then(() => {
      sleep(100).then(() => {
        // as it is starting
        expect(callback).toHaveBeenNthCalledWith(1, true)
      })
      asyncProcess.start().then(() => {
        // after its done starting
        expect(callback).toHaveBeenNthCalledWith(2, false)
        done()
      })
    })
  })

  it(`invokes onActiveStatusChange callback function after starting`, async () => {
    asyncProcess.onActiveStatusChange(callback)
    await asyncProcess.init()
    await asyncProcess.start()
    expect(callback).toHaveBeenCalledWith(true)
  })

  // eslint-disable-next-line jest/no-done-callback
  it(`invokes onStopStatusChange callback function after stopping`, (done) => {
    asyncProcess.onStopStatusChange(callback)
    asyncProcess.init().then(() => {
      asyncProcess.start().then(() => {
        sleep(100).then(() => {
          // as it is stopping
          expect(callback).toHaveBeenNthCalledWith(1, true)
        })
        asyncProcess.stop().then(() => {
          // after its done stopping
          expect(callback).toHaveBeenNthCalledWith(2, false)
          done()
        })
      })
    })
  })

  it(`prevents accidental duplicate initialization callback invokations`, () => {
    asyncProcess.onInitializingStatusChange(callback)
    asyncProcess['setInitializing'](true)
    asyncProcess['setInitializing'](true)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it(`prevents accidental duplicate ready callback invokations`, () => {
    asyncProcess.onReadyStatusChange(callback)
    asyncProcess['setReady'](true)
    asyncProcess['setReady'](true)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it(`prevents accidental duplicate starting callback invokations`, () => {
    asyncProcess.onStartStatusChange(callback)
    asyncProcess['setStarting'](true)
    asyncProcess['setStarting'](true)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it(`prevents accidental duplicate stopping callback invokations`, () => {
    asyncProcess.onStopStatusChange(callback)
    asyncProcess['setStopping'](true)
    asyncProcess['setStopping'](true)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it(`prevents accidental duplicate active callback invokations`, () => {
    asyncProcess.onActiveStatusChange(callback)
    asyncProcess['setActive'](true)
    asyncProcess['setActive'](true)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it(`immediately invokes intializing callback if it is already intializing`, () => {
    asyncProcess['setInitializing'](true)
    asyncProcess.onInitializingStatusChange(callback)
    expect(callback).toHaveBeenCalled()
  })

  it(`immediately invokes ready callback if it is already ready`, () => {
    asyncProcess['setReady'](true)
    asyncProcess.onReadyStatusChange(callback)
    expect(callback).toHaveBeenCalled()
  })

  it(`immediately invokes start callback if it is already starting`, () => {
    asyncProcess['setStarting'](true)
    asyncProcess.onStartStatusChange(callback)
    expect(callback).toHaveBeenCalled()
  })

  it(`immediately invokes stop callback if it is already stopping`, () => {
    asyncProcess['setStopping'](true)
    asyncProcess.onStopStatusChange(callback)
    expect(callback).toHaveBeenCalled()
  })

  it(`immediately invokes stop callback if it is already active`, () => {
    asyncProcess['setActive'](true)
    asyncProcess.onActiveStatusChange(callback)
    expect(callback).toHaveBeenCalled()
  })

  it(`clears all lifecycle callback functions`, async () => {
    asyncProcess.onReadyStatusChange(callback)
    asyncProcess.clear()
    await asyncProcess.init()
    expect(callback).not.toHaveBeenCalled()
  })
})
