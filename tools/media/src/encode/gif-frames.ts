import sharp from 'sharp'

/**
 * Count the frames a finished GIF contains.
 *
 * Read back from the file rather than predicted from the frame plan, because
 * an optimiser is free to merge identical frames and the audit record should
 * say what the file holds rather than what was asked for.
 *
 * @param filePath - Absolute path of the GIF.
 * @returns How many frames the animation contains.
 */
export async function countGifFrames(filePath: string): Promise<number> {
  return (await sharp(filePath).metadata()).pages ?? 1
}
