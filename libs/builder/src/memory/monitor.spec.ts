jest.mock('@hyperfrontend/logging', () => {
  const mockChannel = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  }
  return {
    logger: {
      channel: jest.fn(() => mockChannel),
    },
    __mockChannel: mockChannel,
  }
})

import * as loggingModule from '@hyperfrontend/logging'
import { createMemoryMonitor } from './monitor'

interface MemoryUsageStub {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
}

interface MockedLoggingModule {
  __mockChannel: {
    error: jest.Mock
    warn: jest.Mock
    info: jest.Mock
    debug: jest.Mock
    log: jest.Mock
  }
}

const BYTES_PER_MB = 1024 * 1024

const memoryStub = (heapUsedMB: number, rssMB = heapUsedMB + 50): MemoryUsageStub => ({
  rss: rssMB * BYTES_PER_MB,
  heapTotal: (heapUsedMB + 100) * BYTES_PER_MB,
  heapUsed: heapUsedMB * BYTES_PER_MB,
  external: 5 * BYTES_PER_MB,
  arrayBuffers: 1 * BYTES_PER_MB,
})

const channelLogger = (<MockedLoggingModule>(<unknown>loggingModule)).__mockChannel

describe('createMemoryMonitor', () => {
  let memoryUsageSpy: jest.SpyInstance

  beforeEach(() => {
    channelLogger.error.mockClear()
    channelLogger.warn.mockClear()
    channelLogger.info.mockClear()
    channelLogger.debug.mockClear()
    channelLogger.log.mockClear()
    memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(memoryStub(100))
  })

  afterEach(() => {
    memoryUsageSpy.mockRestore()
  })

  it('captures snapshot data converted from bytes to MB', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(64, 128))
    const monitor = createMemoryMonitor()
    expect(monitor.snapshot('initial')).toEqual(
      expect.objectContaining({
        label: 'initial',
        heapUsedMB: 64,
        heapTotalMB: 164,
        rssMB: 128,
        externalMB: 5,
      })
    )
  })

  it('appends snapshots to history in capture order', () => {
    memoryUsageSpy.mockReturnValueOnce(memoryStub(10)).mockReturnValueOnce(memoryStub(20))
    const monitor = createMemoryMonitor()
    monitor.snapshot('first')
    monitor.snapshot('second')
    expect(monitor.getSnapshots()).toEqual([
      expect.objectContaining({ label: 'first', heapUsedMB: 10 }),
      expect.objectContaining({ label: 'second', heapUsedMB: 20 }),
    ])
  })

  it('returns a defensive copy from getSnapshots', () => {
    const monitor = createMemoryMonitor()
    monitor.snapshot('only')
    const copy = monitor.getSnapshots()
    copy.length = 0
    expect(monitor.getSnapshots()).toHaveLength(1)
  })

  it('logs critical when heap usage reaches the critical threshold', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(800))
    const monitor = createMemoryMonitor()
    monitor.check('phase')
    expect(channelLogger.error).toHaveBeenCalledWith(expect.stringContaining('critical heap usage'))
  })

  it('logs a warning when heap usage is between warning and critical', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(600))
    const monitor = createMemoryMonitor()
    monitor.check('phase')
    expect(channelLogger.warn).toHaveBeenCalledWith(expect.stringContaining('high heap usage'))
  })

  it('does not log warnings when heap usage is below the warning threshold', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(64))
    const monitor = createMemoryMonitor()
    monitor.check('phase')
    expect(channelLogger.warn).not.toHaveBeenCalled()
  })

  it('respects custom warningMB and criticalMB thresholds', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(200))
    const monitor = createMemoryMonitor({ warningMB: 100, criticalMB: 300 })
    monitor.check('phase')
    expect(channelLogger.warn).toHaveBeenCalledWith(expect.stringContaining('threshold 100MB'))
  })

  it('logs growth when heap grows by at least growthMB between successive checks', () => {
    memoryUsageSpy.mockReturnValueOnce(memoryStub(100)).mockReturnValueOnce(memoryStub(200))
    const monitor = createMemoryMonitor({ warningMB: 1024, criticalMB: 2048, growthMB: 50 })
    monitor.check('first')
    monitor.check('second')
    expect(channelLogger.warn).toHaveBeenCalledWith(expect.stringContaining("heap grew 100.0MB since 'first'"))
  })

  it('does not log growth when the delta is below growthMB', () => {
    memoryUsageSpy.mockReturnValueOnce(memoryStub(100)).mockReturnValueOnce(memoryStub(110))
    const monitor = createMemoryMonitor({ warningMB: 1024, criticalMB: 2048, growthMB: 50 })
    monitor.check('first')
    monitor.check('second')
    expect(channelLogger.warn).not.toHaveBeenCalled()
  })

  it('logDebug emits a debug-level line with formatted heap and rss', () => {
    memoryUsageSpy.mockReturnValue(memoryStub(40, 90))
    const monitor = createMemoryMonitor()
    monitor.logDebug('after-bundle')
    expect(channelLogger.debug).toHaveBeenCalledWith('after-bundle: heap=40.0MB rss=90.0MB')
  })

  it('logSummary reports an empty notice when no snapshots have been captured', () => {
    const monitor = createMemoryMonitor()
    monitor.logSummary()
    expect(channelLogger.info).toHaveBeenCalledWith('no snapshots captured')
  })

  it('logSummary reports peak heap, peak rss, snapshot count, and elapsed time', () => {
    memoryUsageSpy.mockReturnValueOnce(memoryStub(50, 120)).mockReturnValueOnce(memoryStub(80, 160)).mockReturnValueOnce(memoryStub(40, 90))
    const monitor = createMemoryMonitor()
    monitor.snapshot('a')
    monitor.snapshot('b')
    monitor.snapshot('c')
    monitor.logSummary()
    expect(channelLogger.info).toHaveBeenCalledWith(expect.stringContaining('peak heap=80.0MB peak rss=160.0MB across 3 snapshots'))
  })
})
