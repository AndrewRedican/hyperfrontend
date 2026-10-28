import { gzipSync } from 'node:zlib'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readPackageTarball, readTar } from './tar'

/**
 * A tar header block.
 *
 * @param name - The entry name
 * @param size - The content size
 * @param type - The type flag
 * @param prefix - The ustar prefix
 * @returns The 512-byte header
 */
function header(name: string, size: number, type: string, prefix = ''): Buffer {
  const block = Buffer.alloc(512)
  block.write(name, 0, 'utf8')
  block.write(size.toString(8).padStart(11, '0'), 124, 'utf8')
  block.write(type, 156, 'utf8')
  block.write(prefix, 345, 'utf8')
  return block
}

/**
 * One entry: its header and its content padded to whole blocks.
 *
 * @param name - The entry name as the archive writes it
 * @param content - The bytes the entry holds
 * @param type - The type flag
 * @param prefix - The ustar prefix
 * @returns The bytes
 */
function entry(name: string, content: string, type = '0', prefix = ''): Buffer {
  const bytes = Buffer.from(content, 'utf8')
  const padded = Buffer.alloc(Math.ceil(bytes.length / 512) * 512)
  bytes.copy(padded)
  return Buffer.concat([header(name, bytes.length, type, prefix), padded])
}

/**
 * One pax record, its length counted the way the format counts it: digits, space, key, equals,
 * value and newline.
 *
 * @param key - The record's key, `path` for a long name
 * @param value - Its value
 * @returns The record text
 */
function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`
  let length = body.length + 1
  if (`${length}`.length + body.length !== length) length += 1
  return `${length}${body}`
}

describe('readTar', () => {
  it('reads regular files, joins the ustar prefix, skips directories and stops at the end blocks', () => {
    const archive = Buffer.concat([
      entry('package/', '', '5'),
      entry('package/index.js', 'export {}\n'),
      entry('lib/deep.js', 'deep\n', '0', 'package'),
      entry('package/empty.js', '', ''),
      Buffer.alloc(1024),
      entry('package/after-end.js', 'ignored\n'),
    ])
    expect(readTar(archive).map((item) => `${item.path}=${item.content.toString('utf8')}`)).toEqual([
      'package/index.js=export {}\n',
      'package/lib/deep.js=deep\n',
      'package/empty.js=',
    ])
  })

  it('takes the path of a pax extended header for the entry that follows', () => {
    const long = `package/${'a'.repeat(120)}.js`
    const archive = Buffer.concat([
      entry('PaxHeader/x', paxRecord('path', long), 'x'),
      entry('package/truncated', 'content\n'),
      entry('package/b.js', 'b\n'),
    ])
    expect(readTar(archive).map((item) => item.path)).toEqual([long, 'package/b.js'])
  })

  it('ignores a pax header without a path record', () => {
    const archive = Buffer.concat([entry('PaxHeader/x', '20 mtime=1234567890\nbroken\nno equals\n', 'x'), entry('package/a.js', 'a\n')])
    expect(readTar(archive).map((item) => item.path)).toEqual(['package/a.js'])
  })

  it('reads a name that fills its field without a terminator', () => {
    const name = `package/${'n'.repeat(92)}`
    expect(readTar(Buffer.concat([entry(name, 'x\n')])).map((item) => item.path)).toEqual([name])
  })
})

describe('readPackageTarball', () => {
  it('decompresses the tarball and strips the package prefix', () => {
    const tarball = gzipSync(Buffer.concat([entry('package/index.js', 'x\n'), entry('other/readme', 'y\n'), Buffer.alloc(1024)]))
    expect(readPackageTarball(tarball).map((item) => `${item.path}=${item.content.toString('utf8')}`)).toEqual([
      'index.js=x\n',
      'other/readme=y\n',
    ])
  })
})
