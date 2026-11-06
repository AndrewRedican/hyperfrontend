/**
 * Compares generated texts with the files on disk, so a check fails on any byte that differs.
 *
 * @module types-extract/check
 */

/** Reads a workspace-relative file, or null when it does not exist. */
export type ReadFile = (path: string) => string | null

/** What differs between the generated texts and the disk. */
export interface Differences {
  /** Generated files absent from the disk. */
  readonly missing: readonly string[]
  /** Files on disk whose text differs from the generated one. */
  readonly stale: readonly string[]
}

/**
 * Compares generated texts with the disk.
 *
 * @param generated - The generated texts, by workspace-relative path
 * @param readFile - Reads a file from the disk
 * @returns The differences; both lists empty when the disk is current
 */
export function compareGenerated(generated: ReadonlyMap<string, string>, readFile: ReadFile): Differences {
  const missing: string[] = []
  const stale: string[] = []
  for (const [path, text] of generated) {
    const existing = readFile(path)
    if (existing === null) missing.push(path)
    else if (existing !== text) stale.push(path)
  }
  return { missing, stale }
}
