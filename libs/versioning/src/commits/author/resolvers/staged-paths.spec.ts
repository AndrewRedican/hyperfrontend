import * as childProcess from 'node:child_process'
import { getStagedPaths } from './staged-paths'

jest.mock('node:child_process')

const execFileSync = <jest.MockedFunction<typeof childProcess.execFileSync>>childProcess.execFileSync

describe('getStagedPaths', () => {
  beforeEach(() => {
    execFileSync.mockReset()
  })

  it('splits the NUL-terminated git output into entries', () => {
    execFileSync.mockReturnValue('libs/a/index.ts\0libs/b/index.ts\0')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual(['libs/a/index.ts', 'libs/b/index.ts'])
  })

  it('returns an empty list when nothing is staged', () => {
    execFileSync.mockReturnValue('')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual([])
  })

  it('handles trailing content with no terminator', () => {
    execFileSync.mockReturnValue('libs/a/index.ts')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual(['libs/a/index.ts'])
  })

  it('wraps git errors with a descriptive message', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('not a git repo')
    })
    expect(() => getStagedPaths({ cwd: '/repo' })).toThrow('Failed to read staged paths: not a git repo')
  })
})
