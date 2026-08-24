import type { ServeSpec } from '../models/capture'
import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { findFreePort } from './free-port'
import { waitForHttp } from './wait-for-http'

/** A server the recorder started, and the handle that stops it again. */
export interface ServerHandle {
  /** Origin the server is listening on. */
  origin: string
  /** Stop the server. Safe to call more than once. */
  stop: () => void
}

/**
 * Substitute the placeholders a serve command is allowed to use.
 *
 * Only two exist, `{root}` and `{port}`, because those are the two things the
 * recorder decides and the scene cannot know in advance.
 *
 * @param argv - The command as authored.
 * @param root - Absolute directory being served.
 * @param port - Port allocated for this run.
 * @returns The command with placeholders replaced.
 */
function substitute(argv: readonly string[], root: string, port: number): readonly string[] {
  return argv.map((token) => token.replace('{root}', root).replace('{port}', `${port}`))
}

/**
 * Run a command to completion, letting its output through to the terminal.
 *
 * @param argv - Command and its arguments.
 * @param cwd - Working directory.
 * @param env - Extra environment variables.
 * @throws {Error} When the command exits non-zero or was empty.
 */
export function runOnce(argv: readonly string[], cwd: string, env: Record<string, string>): void {
  const command = argv[0]
  if (command === undefined) {
    throw mediaError(ExitCode.ConfigInvalid, 'A command was declared with no executable')
  }
  try {
    execFileSync(command, argv.slice(1), { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
  } catch (cause) {
    throw mediaError(ExitCode.SceneFailed, `${argv.join(' ')} failed: ${cause instanceof Error ? cause.message : `${cause}`}`)
  }
}

/**
 * Start the server a scene declared and wait until it answers.
 *
 * The child is detached from this process's stdio so a chatty server does not
 * bury the run summary, and it is killed on the way out whether the scene
 * succeeded or not.
 *
 * @param spec - The serve block from the scene.
 * @param rootDir - Directory the scene's relative paths resolve against.
 * @returns The running server and the handle that stops it.
 * @throws {Error} When the server never answers.
 */
export async function startServer(spec: ServeSpec, rootDir: string): Promise<ServerHandle> {
  const cwd = spec.cwd === undefined ? rootDir : join(rootDir, spec.cwd)
  const env = spec.env ?? {}
  if (spec.build !== undefined) {
    runOnce(spec.build, rootDir, env)
  }
  const port = await findFreePort()
  const argv = substitute(spec.command, spec.root === undefined ? rootDir : join(rootDir, spec.root), port)
  const command = argv[0]
  if (command === undefined) {
    throw mediaError(ExitCode.ConfigInvalid, 'The serve command has no executable')
  }
  const child = spawn(command, argv.slice(1), { cwd, stdio: 'ignore', env: { ...process.env, ...env } })
  const origin = `http://127.0.0.1:${port}`
  const stop = (): void => {
    child.kill('SIGTERM')
  }
  try {
    await waitForHttp(`${origin}${spec.readyPath ?? '/'}`, spec.readyTimeoutMs ?? 60_000)
  } catch (cause) {
    stop()
    throw cause
  }
  return { origin, stop }
}
