import type { AssetSidecar } from '../models/report'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Digest a scene file so a stale asset can be told from a current one.
 *
 * Only the first sixteen hex characters are kept: the digest is compared, not
 * relied on for anything else, and a short one keeps the record readable.
 *
 * @param filePath - Absolute path of the scene file.
 * @returns A short hex digest.
 */
export function hashScene(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16)
}

/**
 * Produce the current timestamp in the form the audit record stores it.
 *
 * @returns An ISO 8601 string.
 */
export function nowIso(): string {
  return createDate().toISOString()
}

/**
 * Write the audit record that sits beside an asset.
 *
 * @param filePath - Absolute path of the record.
 * @param record - What the run produced.
 */
export function writeSidecar(filePath: string, record: AssetSidecar): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${stringify(record, undefined, 2)}\n`)
}

/**
 * Read the audit record beside an asset.
 *
 * @param filePath - Absolute path of the record.
 * @returns The record, or undefined when it is missing or unreadable.
 */
export function readSidecar(filePath: string): AssetSidecar | undefined {
  if (!existsSync(filePath)) {
    return undefined
  }
  try {
    return <AssetSidecar>parse(readFileSync(filePath, 'utf8'))
  } catch {
    return undefined
  }
}
