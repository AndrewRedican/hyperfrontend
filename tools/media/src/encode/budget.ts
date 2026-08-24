import { formatBytes } from '../lib/format-bytes'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'

/**
 * Fail the run when a finished asset is larger than its scene allows.
 *
 * The failure is deliberate rather than a warning: scene content dominates
 * file size far more than encoder flags do, so an asset over budget means the
 * scene needs narrowing or shortening, and a warning would let it land anyway.
 *
 * @param slug - Directory name of the scene that produced the asset.
 * @param bytes - Size of the finished file.
 * @param maxBytes - Size ceiling the scene declared.
 * @throws {Error} When the file is larger than the ceiling.
 */
export function assertWithinBudget(slug: string, bytes: number, maxBytes: number): void {
  if (bytes <= maxBytes) {
    return
  }
  throw mediaError(
    ExitCode.BudgetExceeded,
    `${slug}: ${formatBytes(bytes)} exceeds the ${formatBytes(maxBytes)} budget. ` +
      'Narrow the frame, shorten the record window or drop the frame rate before raising maxBytes.'
  )
}
