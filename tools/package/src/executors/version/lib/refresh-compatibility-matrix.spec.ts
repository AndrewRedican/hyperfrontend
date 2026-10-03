import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { refreshCompatibilityDocument } from '@hyperfrontend/workspace'
import { refreshCompatibilityMatrix } from './refresh-compatibility-matrix'

jest.mock('@hyperfrontend/workspace', () => ({
  COMPATIBILITY_DOCUMENT_NAME: 'LIBRARY_COMPATIBILITY.md',
  buildCompatibilityDocument: jest.fn(() => '# Library Compatibility Matrix\n'),
  refreshCompatibilityDocument: jest.fn(),
}))

const mockRefresh = jest.mocked(refreshCompatibilityDocument)

describe('refreshCompatibilityMatrix', () => {
  it('returns the document path when the refresh rewrote it', () => {
    mockRefresh.mockReturnValueOnce('LIBRARY_COMPATIBILITY.md')
    expect(refreshCompatibilityMatrix('/abs/repo', false)).toEqual(['LIBRARY_COMPATIBILITY.md'])
  })

  it('returns nothing when the document already matched', () => {
    mockRefresh.mockReturnValueOnce(null)
    expect(refreshCompatibilityMatrix('/abs/repo', false)).toEqual([])
  })

  it('refreshes against the workspace it is given', () => {
    mockRefresh.mockReturnValueOnce(null)
    refreshCompatibilityMatrix('/abs/repo', false)
    expect(mockRefresh).toHaveBeenCalledWith('/abs/repo')
  })

  it('writes nothing on a dry run', () => {
    mockRefresh.mockClear()
    refreshCompatibilityMatrix('/abs/repo', true)
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('reports no files on a dry run', () => {
    expect(refreshCompatibilityMatrix('/abs/repo', true)).toEqual([])
  })
})
