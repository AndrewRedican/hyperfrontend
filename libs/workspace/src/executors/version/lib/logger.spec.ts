import { afterEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { captureStdio } from '@hyperfrontend/testing/process'
import { getLogger } from './logger'

afterEach(() => {
  getLogger().setLogLevel({ verbose: false, quiet: false })
})

/**
 * What a fresh channel writes while a call runs.
 *
 * @param verbose - Whether the log runs at debug level
 * @param write - Writes to the channel
 * @returns What reached stdout
 */
function written(verbose: boolean, write: (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => void): string {
  const logger = getLogger()
  logger.setLogLevel({ verbose, quiet: false })
  const stdio = captureStdio()
  try {
    write(logger.channel('header probe'))
    return stdio.stdout()
  } finally {
    stdio.restore()
  }
}

describe('getLogger channel header', () => {
  it.each([
    ['step', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.step('hidden')],
    ['item', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.item('hidden')],
    ['debug', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.debug('hidden')],
    ['info', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.info('hidden')],
  ])('prints nothing for a %s line the default level filters out', (_name, write) => {
    expect(written(false, write)).toBe('')
  })

  it('prints the header above a line the default level shows', () => {
    expect(written(false, (channel) => channel.log('shown'))).toEqual(expect.stringContaining('[ Header probe ]'))
  })

  it.each([
    ['step', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.step('shown')],
    ['item', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.item('shown')],
    ['debug', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.debug('shown')],
    ['info', (channel: ReturnType<ReturnType<typeof getLogger>['channel']>) => channel.info('shown')],
  ])('prints the header above a %s line at debug level', (_name, write) => {
    expect(written(true, write)).toEqual(expect.stringContaining('[ Header probe ]'))
  })

  it('prints the header once for several lines', () => {
    const out = written(false, (channel) => {
      channel.log('first')
      channel.log('second')
    })
    expect(out.split('[ Header probe ]').length).toBe(2)
  })
})
