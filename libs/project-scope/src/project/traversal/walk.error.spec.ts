import type { MockedFunction } from '@hyperfrontend/testing'
import { resolve } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fsModule from '../../core/fs'
import { walkDirectory } from './walk'

// why: the module under test binds `readDirectory` when it links, so no property replacement on the namespace can reach it. Replacing the module is what makes the read failures reachable, and the replacement calls through until a test says otherwise.
jest.mock('../../core/fs', () => {
  const actual = jest.requireActual<typeof fsModule>('../../core/fs')
  return { ...actual, readDirectory: jest.fn(actual.readDirectory) }
})

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const mockReadDirectory = fsModule.readDirectory as MockedFunction<typeof fsModule.readDirectory>

describe('walkDirectory - error propagation', () => {
  it('propagates a directory-read error that is not a filesystem failure', () => {
    mockReadDirectory.mockImplementation(() => {
      throw new TypeError('isAbsolute$1 is not defined')
    })

    expect(() => walkDirectory(MINIMAL_PROJECT, () => undefined)).toThrow('isAbsolute$1 is not defined')
  })

  it('treats a coded filesystem failure as an empty directory', () => {
    mockReadDirectory.mockImplementation(() => {
      const error = new Error('EACCES: permission denied')
      ;(error as { code?: string }).code = 'EACCES'
      throw error
    })

    const visited: string[] = []
    walkDirectory(MINIMAL_PROJECT, (entry) => {
      visited.push(entry.relativePath)
    })

    expect(visited).toEqual([])
  })
})
