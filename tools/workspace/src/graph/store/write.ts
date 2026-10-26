/**
 * How a state file is written: an envelope carrying the body, a digest of the body's canonical
 * text and the schema, as canonical JSON with a trailing newline; written to a temporary name and
 * renamed into place, and not written at all when the file already holds the same bytes.
 *
 * @module graph/store/write
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { canonicalJson, sha256 } from './hashes'
import { SCHEMA } from './meta'

/** A state file's content. */
export interface Envelope<Body> {
  /** The body. */
  readonly body: Body
  /** The sha256 of the body's canonical text. */
  readonly digest: string
  /** The schema the file follows. */
  readonly schema: string
}

/** What precedes the body in a state file. */
export const ENVELOPE_HEAD = '{"body":'

/**
 * What follows the body in a state file.
 *
 * @param digest - The body's digest
 * @returns The closing text, newline included
 */
export function envelopeTail(digest: string): string {
  return `,"digest":"${digest}","schema":"${SCHEMA}"}\n`
}

/**
 * The text of a state file holding a body: the canonical JSON of its envelope, with the body
 * canonicalised once and digested as written.
 *
 * @param body - The body to wrap
 * @returns The text, with a trailing newline
 */
export function envelopeText(body: unknown): string {
  const text = canonicalJson(body)
  return `${ENVELOPE_HEAD}${text}${envelopeTail(sha256(text))}`
}

/**
 * Writes a state file unless it already holds the same text; a process writes its own temporary
 * file and renames it into place, so a reader never sees half a file.
 *
 * @param path - The file, absolute
 * @param text - What it should hold
 * @returns True when the file was written, false when it already agreed
 */
export function writeStateFile(path: string, text: string): boolean {
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return false
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, text)
  renameSync(temporary, path)
  return true
}
