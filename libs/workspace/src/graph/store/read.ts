/**
 * How a state file is read back: its envelope parsed, its schema checked and its digest recomputed
 * over the body text as written, so a truncated, edited or foreign file reads as absent rather than
 * as state.
 *
 * @module graph/store/read
 */

import type { Envelope } from './write'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { sha256 } from './hashes'
import { SCHEMA } from './meta'
import { ENVELOPE_HEAD, envelopeTail } from './write'

/**
 * The body of a state file, or nothing when the file is absent, does not parse, follows another
 * schema, is not laid out as written, or does not match its own digest.
 *
 * @param path - The file, absolute
 * @returns The body, or null
 */
export function readStateFile<Body>(path: string): Body | null {
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  try {
    const envelope = parse(text) as Partial<Envelope<Body>> | null
    if (envelope === null || envelope.schema !== SCHEMA || typeof envelope.digest !== 'string' || envelope.body === undefined) return null
    const tail = envelopeTail(envelope.digest)
    if (!text.startsWith(ENVELOPE_HEAD) || !text.endsWith(tail)) return null
    return sha256(text.slice(ENVELOPE_HEAD.length, text.length - tail.length)) === envelope.digest ? envelope.body : null
  } catch {
    return null
  }
}
