import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { servedPath } from './served-path'

// why: a stored path only carries a drive letter and backslash separators when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return { relative: win32.relative, sep: win32.sep }
})

const ROOT = 'C:\\srv\\site'

// how: Answers each asked path from a table of stored ones, and null for a path the table does not hold.
const storedIn =
  (table: Readonly<Record<string, string>>) =>
  (path: string): string | null =>
    table[path] ?? null

describe('servedPath on Windows', () => {
  it('expands a short name into the long one a rule is written against', () => {
    const stored = storedIn({ [ROOT]: ROOT, 'C:\\srv\\site\\HOSTAR~1\\INDEX~1.HTM': 'C:\\srv\\site\\host-area\\index.html' })
    expect(servedPath(ROOT, 'C:\\srv\\site\\HOSTAR~1\\INDEX~1.HTM', stored)).toBe('/host-area/index.html')
  })

  it('reads a root asked by its short name from its long one', () => {
    const stored = storedIn({
      'C:\\Users\\RUNNER~1\\site': 'C:\\Users\\runneradmin\\site',
      'C:\\Users\\RUNNER~1\\site\\Host\\app.js': 'C:\\Users\\runneradmin\\site\\host\\app.js',
    })
    expect(servedPath('C:\\Users\\RUNNER~1\\site', 'C:\\Users\\RUNNER~1\\site\\Host\\app.js', stored)).toBe('/host/app.js')
  })

  it('reads the path below a stored root that is a drive root', () => {
    const stored = storedIn({ [ROOT]: 'D:\\', 'C:\\srv\\site\\HOST\\index.html': 'D:\\host\\index.html' })
    expect(servedPath(ROOT, 'C:\\srv\\site\\HOST\\index.html', stored)).toBe('/host/index.html')
  })

  it('drops the dot a request added after a name the volume stores without one', () => {
    const stored = storedIn({ [ROOT]: ROOT, 'C:\\srv\\site\\host.\\index.html.': 'C:\\srv\\site\\host\\index.html' })
    expect(servedPath(ROOT, 'C:\\srv\\site\\host.\\index.html.', stored)).toBe('/host/index.html')
  })

  it('answers the path as resolved, with forward slashes, when the stored file is on another drive', () => {
    const stored = storedIn({ [ROOT]: ROOT, 'C:\\srv\\site\\mount\\app.js': 'E:\\app.js' })
    expect(servedPath(ROOT, 'C:\\srv\\site\\mount\\app.js', stored)).toBe('/mount/app.js')
  })

  it('answers the path as resolved when the stored one is unknown', () => {
    expect(servedPath(ROOT, 'C:\\srv\\site\\HOST\\app.js', storedIn({}))).toBe('/HOST/app.js')
  })
})
