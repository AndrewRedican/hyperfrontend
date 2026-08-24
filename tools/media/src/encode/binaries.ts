import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Executable names Playwright uses for its bundled ffmpeg, one per platform. */
const BUNDLED_FFMPEG_NAMES: readonly string[] = ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win.exe']

/**
 * Read the first line a command prints when asked for its version.
 *
 * @param command - Command to invoke.
 * @param versionFlag - Flag that makes it print a version.
 * @returns The first line of output, or an empty string when the command fails.
 */
export function readVersion(command: string, versionFlag: string): string {
  try {
    return execFileSync(command, [versionFlag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0] ?? ''
  } catch {
    return ''
  }
}

/**
 * Report whether a command is installed and answers.
 *
 * Asking it for its version is a stronger check than looking for the file,
 * because it also catches a binary that is present but cannot execute here.
 *
 * @param command - Command to invoke.
 * @param versionFlag - Flag that makes it print a version.
 * @returns True when the command ran.
 */
export function commandAvailable(command: string, versionFlag: string): boolean {
  return readVersion(command, versionFlag) !== ''
}

/**
 * Find the ffmpeg build that ships alongside the cached browsers.
 *
 * It is not a system package, so a machine with no ffmpeg installed can still
 * turn a recorded video into frames as long as a browser has been downloaded.
 *
 * @returns An absolute path, or an empty string when no cached build exists.
 */
export function findBundledFfmpeg(): string {
  const cacheRoot = process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cacheRoot)) {
    return ''
  }
  for (const entry of readdirSync(cacheRoot).sort()) {
    if (!entry.startsWith('ffmpeg-')) {
      continue
    }
    for (const name of BUNDLED_FFMPEG_NAMES) {
      const candidate = join(cacheRoot, entry, name)
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }
  return ''
}

/**
 * Pick an ffmpeg capable of demuxing a recorded video into frames.
 *
 * A configured system build is preferred because it can do the whole encode;
 * the bundled build is stripped down and can only produce frames.
 *
 * @param configured - The ffmpeg command a workspace configured.
 * @returns An absolute path or command name, or an empty string when none exists.
 */
export function resolveFrameFfmpeg(configured: string): string {
  return commandAvailable(configured, '-version') ? configured : findBundledFfmpeg()
}
