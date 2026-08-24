import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Render a byte count the way a person reading a size budget wants to see it.
 *
 * Kilobytes below a megabyte and one decimal above, because the decision a
 * reader is making is "is this too big for a README", not "how many bytes".
 *
 * @param bytes - The size to render.
 * @returns A short human-readable size.
 */
export function formatBytes(bytes: number): string {
  return bytes < 1_048_576 ? `${round(bytes / 1024)}KB` : `${round(bytes / 104_857.6) / 10}MB`
}
