/**
 * A reader for the tarballs npm publishes: ustar headers with the pax extended headers npm's
 * packer writes for long paths, decompressed with Node's zlib, so a registry artifact is compared
 * file by file without a system `tar`.
 *
 * @module artifact-drift/tar
 */

import { posix } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { ceil } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** One regular file of a tarball. */
export interface TarEntry {
  /** The path as the archive names it. */
  readonly path: string
  /** The content. */
  readonly content: Buffer
}

/** The size of one tar block. */
const BLOCK = 512

/**
 * A NUL-terminated string field of a header.
 *
 * @param header - The header block
 * @param offset - Where the field starts
 * @param length - How many bytes the field spans
 * @returns The text before the first NUL
 */
function field(header: Buffer, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length)
  const end = raw.indexOf(0)
  return raw.subarray(0, end === -1 ? length : end).toString('utf8')
}

/**
 * The size an entry's header declares.
 *
 * @param header - The header block
 * @returns The size in bytes
 */
function sizeOf(header: Buffer): number {
  return parseInt(field(header, 124, 12).trim(), 8)
}

/**
 * The path a pax extended header overrides, if it carries one.
 *
 * @param content - The extended header's records, each `<length> <key>=<value>\n`
 * @returns The `path` value, or null
 */
function paxPath(content: Buffer): string | null {
  for (const record of content.toString('utf8').split(/\r?\n/)) {
    const space = record.indexOf(' ')
    const equals = record.indexOf('=')
    if (space === -1 || equals === -1) continue
    if (record.slice(space + 1, equals) === 'path') return record.slice(equals + 1)
  }
  return null
}

/**
 * The regular files of a tar archive.
 *
 * @param archive - The uncompressed archive
 * @returns The entries, in archive order
 */
export function readTar(archive: Buffer): TarEntry[] {
  const entries: TarEntry[] = []
  let overridden: string | null = null
  for (let offset = 0; offset + BLOCK <= archive.length; ) {
    const header = archive.subarray(offset, offset + BLOCK)
    if (header[0] === 0) break
    const size = sizeOf(header)
    const type = field(header, 156, 1)
    const content = archive.subarray(offset + BLOCK, offset + BLOCK + size)
    const prefix = field(header, 345, 155)
    const name = field(header, 0, 100)
    const path = overridden ?? (prefix === '' ? name : `${prefix}/${name}`)
    overridden = null
    if (type === 'x') overridden = paxPath(content)
    else if (type === '0' || type === '') entries.push({ path, content: Buffer.from(content) })
    offset += BLOCK + ceil(size / BLOCK) * BLOCK
  }
  return entries
}

/**
 * The regular files of a gzipped tarball, the leading `package/` npm adds stripped.
 *
 * @param tarball - The compressed archive
 * @returns The entries by path within the package
 */
export function readPackageTarball(tarball: Buffer): TarEntry[] {
  return readTar(gunzipSync(tarball)).map((entry) => ({
    path: entry.path.startsWith(`package${posix.sep}`) ? entry.path.slice(`package${posix.sep}`.length) : entry.path,
    content: entry.content,
  }))
}
