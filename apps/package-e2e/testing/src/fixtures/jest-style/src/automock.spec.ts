import { spawnSync } from 'node:child_process'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { nodeStatus } from './shell'

jest.mock('node:child_process')

describe('jest.mock automock of a built-in', () => {
  it('turns the named export into a mock function', () => {
    expect(jest.mocked(spawnSync).mock.calls).toEqual([])
  })

  it('hands the configured return value to the code under test', () => {
    jest.mocked(spawnSync).mockReturnValue({ status: 7 } as ReturnType<typeof spawnSync>)
    expect(nodeStatus()).toBe(7)
    expect(spawnSync).toHaveBeenCalledWith(process.execPath, ['--version'])
  })
})
