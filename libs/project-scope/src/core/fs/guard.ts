/**
 * Reports whether a path is free of NUL bytes and therefore safe to hand to the
 * filesystem.
 *
 * A NUL byte (the U+0000 code point) can truncate a path inside native syscalls
 * — the classic "poison null byte" — so the target actually opened differs from
 * the string that was validated. Rejecting it before the path reaches `fs`
 * closes that gap.
 *
 * Separator characters are intentionally allowed: `/` is the POSIX separator and
 * `\` is both the Windows separator and a legal POSIX filename character, so
 * neither is unsafe on its own. Confinement of a path to a directory is the
 * caller's concern, not this primitive's.
 *
 * @param filePath - The path to validate.
 * @returns True when the path contains no NUL byte.
 *
 * @example Rejecting a poisoned path before a read
 * ```typescript
 * isSafePath('src/index.ts') // true
 * isSafePath('src/index.ts\u0000.png') // false
 * ```
 */
export function isSafePath(filePath: string): boolean {
  return !filePath.includes('\u0000')
}
