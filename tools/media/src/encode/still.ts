import type { StillOptions } from '../models/encode'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import sharpFactory from 'sharp'

/**
 * Write a captured frame to disk in the requested format and size.
 *
 * PNG passes straight through when neither a resize nor a quality is asked
 * for, so a debugging screenshot is the exact bytes the browser produced rather
 * than a re-encode of them; a still that names a quality is quantised to a
 * palette, which is what a drawn frame wants.
 *
 * @param captured - The image as the browser captured it.
 * @param outputPath - Absolute path to write to.
 * @param options - Format, quality and target width.
 * @returns Size of the written file.
 */
export async function writeStill(captured: Buffer, outputPath: string, options: StillOptions): Promise<number> {
  mkdirSync(dirname(outputPath), { recursive: true })
  if (options.format === 'png' && options.width === 0 && options.quality >= 100) {
    writeFileSync(outputPath, captured)
    return captured.length
  }
  const resized = options.width === 0 ? sharpFactory(captured) : sharpFactory(captured).resize({ width: options.width })
  // why: a drawn frame has a few hundred colours at most, so an indexed PNG at a high quality is a third the size of a true-colour one and looks the same; a photograph never goes through this format
  const encoded =
    options.format === 'png'
      ? resized.png({ palette: true, quality: options.quality, effort: 10 })
      : options.format === 'webp'
        ? resized.webp({ quality: options.quality })
        : resized.jpeg({ quality: options.quality })
  return (await encoded.toFile(outputPath)).size
}
