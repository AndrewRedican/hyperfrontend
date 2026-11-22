import type { ServerResponse } from 'node:http'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { confineDecodedPath, decodeRequestPath, directoryLocation, passesThroughLink, serveFile } from './static-handler'

// why: a root only carries a drive letter and backslash separators when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return {
    dirname: win32.dirname,
    extname: win32.extname,
    join: win32.join,
    normalize: win32.normalize,
    relative: win32.relative,
    resolve: win32.resolve,
    sep: win32.sep,
  }
})

const ROOT = 'C:\\srv\\site'

interface Answer {
  status: number
  headers: Record<string, string>
  body: string
}

// how: Serves one request against a file system that holds exactly the listed native paths, the listed ones of them reached as links, and reports what was written.
const serve = (urlPath: string, files: readonly string[], links: readonly string[] = []): Answer => {
  const answer: Answer = { status: 0, headers: {}, body: '' }
  const res = {
    set statusCode(value: number) {
      answer.status = value
    },
    setHeader: (key: string, value: string) => {
      answer.headers[key] = value
    },
    end: (chunk?: Buffer | string) => {
      answer.body = chunk === undefined ? '' : chunk.toString()
    },
  } as unknown as ServerResponse
  serveFile(ROOT, urlPath, res, {
    isFile: (path) => files.includes(path),
    isSymlink: (path) => links.includes(path),
    readFile: (path) => Buffer.from(`bytes:${path}`),
  })
  return answer
}

describe('confineDecodedPath on Windows', () => {
  it('confines a request path to a native path under the drive root', () => {
    expect(confineDecodedPath(ROOT, '/assets/app.js')).toBe('C:\\srv\\site\\assets\\app.js')
  })

  it('confines the root path to the root itself', () => {
    expect(confineDecodedPath(ROOT, '/')).toBe(ROOT)
  })

  it('confines the same file when the root is spelled with forward slashes', () => {
    expect(confineDecodedPath('C:/srv/site', '/app.js')).toBe('C:\\srv\\site\\app.js')
  })

  it('confines the same file when the root carries a trailing backslash', () => {
    expect(confineDecodedPath(`${ROOT}\\`, '/app.js')).toBe('C:\\srv\\site\\app.js')
  })

  it('reads a backslash-separated request path as nested under the root', () => {
    expect(confineDecodedPath(ROOT, '/assets\\app.js')).toBe('C:\\srv\\site\\assets\\app.js')
  })

  it('keeps a traversal that stays inside the root', () => {
    expect(confineDecodedPath(ROOT, '/assets\\..\\app.js')).toBe('C:\\srv\\site\\app.js')
  })

  it('reads a UNC-shaped request path as relative to the root', () => {
    expect(confineDecodedPath(ROOT, '\\\\server\\share\\file.txt')).toBe('C:\\srv\\site\\server\\share\\file.txt')
  })

  it('reads a drive-relative request path on the root drive as relative to the root', () => {
    expect(confineDecodedPath(ROOT, '/C:app.js')).toBe('C:\\srv\\site\\app.js')
  })

  it.each([
    ['a forward-slash traversal', '/../secret.txt'],
    ['a backslash traversal', '/..\\secret.txt'],
    ['a mixed-separator traversal', '/assets/..\\..\\secret.txt'],
    ['a traversal behind leading backslashes', '\\\\..\\secret.txt'],
    ['a sibling directory sharing the root name as a prefix', '/..\\site-old\\secret.txt'],
    ['an absolute path on another drive', '/D:\\secret.txt'],
    ['an absolute path on another drive spelled with forward slashes', '/D:/secret.txt'],
    ['a drive-relative path on another drive', '/D:secret.txt'],
    ['an absolute path on the root drive that leaves the root', '/C:\\Windows\\win.ini'],
    ['a drive-relative traversal on the root drive', '/C:..\\secret.txt'],
  ])('rejects %s', (_shape, decoded) => {
    expect(confineDecodedPath(ROOT, decoded)).toBeNull()
  })

  it('rejects a percent-encoded backslash traversal once it is decoded', () => {
    expect(confineDecodedPath(ROOT, decodeRequestPath('/..%5C..%5Csecret.txt') as string)).toBeNull()
  })
})

describe('directoryLocation on Windows', () => {
  it('writes a native nested directory as a forward-slash location', () => {
    expect(directoryLocation(ROOT, 'C:\\srv\\site\\host\\panel', '/host/panel?debug=1')).toBe('/host/panel/?debug=1')
  })

  it('encodes a directory name that carries reserved characters', () => {
    expect(directoryLocation(ROOT, 'C:\\srv\\site\\a b#c', '/a%20b%23c')).toBe('/a%20b%23c/')
  })
})

describe('passesThroughLink on Windows', () => {
  // how: Records every native path the walk asks about and reports the listed ones as links.
  const walk = (root: string, confined: string, links: readonly string[] = []) => {
    const asked: string[] = []
    const linked = passesThroughLink(root, confined, (path) => {
      asked.push(path)
      return links.includes(path)
    })
    return { linked, asked }
  }

  it('tests each native segment below the drive root and stops short of the root', () => {
    expect(walk(ROOT, 'C:\\srv\\site\\host\\panel\\app.js')).toEqual({
      linked: false,
      asked: ['C:\\srv\\site\\host\\panel\\app.js', 'C:\\srv\\site\\host\\panel', 'C:\\srv\\site\\host'],
    })
  })

  it('reports a junction above the file', () => {
    expect(walk(ROOT, 'C:\\srv\\site\\host\\panel\\app.js', ['C:\\srv\\site\\host']).linked).toBe(true)
  })

  it('stops short of a root spelled with forward slashes', () => {
    expect(walk('C:/srv/site', 'C:\\srv\\site\\app.js').asked).toEqual(['C:\\srv\\site\\app.js'])
  })

  it('stops short of a root that carries a trailing backslash', () => {
    expect(walk(`${ROOT}\\`, 'C:\\srv\\site\\app.js').asked).toEqual(['C:\\srv\\site\\app.js'])
  })

  it('stops short of a share root', () => {
    expect(walk('\\\\server\\share\\site', '\\\\server\\share\\site\\host\\app.js').asked).toEqual([
      '\\\\server\\share\\site\\host\\app.js',
      '\\\\server\\share\\site\\host',
    ])
  })
})

describe('serveFile on Windows', () => {
  it('answers 404 for a file below a junction', () => {
    expect(serve('/host/app.js', ['C:\\srv\\site\\host\\app.js'], ['C:\\srv\\site\\host'])).toEqual({
      status: 404,
      headers: {},
      body: 'Not Found',
    })
  })

  it('answers 404 instead of redirecting to the index below a junction', () => {
    expect(serve('/host/panel', ['C:\\srv\\site\\host\\panel\\index.html'], ['C:\\srv\\site\\host'])).toEqual({
      status: 404,
      headers: {},
      body: 'Not Found',
    })
  })

  it('serves the index at its native path for the root URL', () => {
    expect(serve('/', ['C:\\srv\\site\\index.html'])).toEqual({
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: 'bytes:C:\\srv\\site\\index.html',
    })
  })

  it('redirects an unslashed directory URL to its forward-slash form', () => {
    expect(serve('/host/panel', ['C:\\srv\\site\\host\\panel\\index.html'])).toEqual({
      status: 301,
      headers: { Location: '/host/panel/' },
      body: '',
    })
  })

  it.each([
    ['a percent-encoded backslash traversal', '/..%5C..%5Csecret.txt'],
    ['a percent-encoded path on another drive', '/D%3A%5Csecret.txt'],
    ['a dot-segment traversal', '/../secret.txt'],
  ])('answers 403 to %s', (_shape, urlPath) => {
    expect(serve(urlPath, ['C:\\secret.txt', 'C:\\srv\\secret.txt', 'D:\\secret.txt'])).toEqual({
      status: 403,
      headers: {},
      body: 'Forbidden',
    })
  })
})
