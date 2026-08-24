import type { ParsedArgs } from './args'
import { resolve } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { loadConfig } from '../config/load-config'
import { logger } from '../lib/logger'
import { isMediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { renderJson, renderSummary } from '../report/summary'
import { parseArgs, readString } from './args'
import { runCheck } from './commands/check'
import { runDoctor } from './commands/doctor'
import { runRecord } from './commands/record'
import { runShot } from './commands/shot'
import { USAGE } from './usage'

/**
 * Run one command and report what it produced.
 *
 * Primary output goes to stdout so it can be piped; everything else goes to
 * stderr through the logger, which is what keeps `--json` output parseable
 * even when a run is chatty.
 *
 * @param args - The parsed command line.
 * @returns The exit code the process should use.
 */
async function dispatch(args: ParsedArgs): Promise<ExitCode> {
  const asJson = args.flags.has('json')
  const config = await loadConfig(resolve(readString(args, 'config', 'media.config.ts')))

  if (args.command === 'doctor') {
    process.stdout.write(`${runDoctor(config, asJson)}\n`)
    return ExitCode.Ok
  }
  if (args.command === 'shot') {
    process.stdout.write(`${await runShot(config, args)}\n`)
    return ExitCode.Ok
  }
  if (args.command === 'check') {
    const outcome = await runCheck(config, readString(args, 'scene', ''))
    if (asJson) {
      process.stdout.write(`${stringify(outcome, undefined, 2)}\n`)
    } else {
      const lines = outcome.issues.map((issue) => `  ${issue.slug}: ${issue.reason}`)
      process.stdout.write(`${outcome.checked} scenes checked, ${outcome.issues.length} problems\n${lines.join('\n')}\n`)
    }
    return outcome.issues.length === 0 ? ExitCode.Ok : ExitCode.CheckFailed
  }
  const rows = await runRecord(config, args)
  process.stdout.write(`${asJson ? renderJson(rows) : renderSummary(rows)}\n`)
  return ExitCode.Ok
}

/**
 * Entry point: parse, dispatch, and turn any failure into an exit code.
 *
 * @returns The exit code the process should use.
 */
async function main(): Promise<ExitCode> {
  let args: ParsedArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : `${cause}`}\n\n${USAGE}`)
    return ExitCode.Usage
  }
  if (args.flags.has('help') || args.command === '') {
    process.stdout.write(USAGE)
    return args.command === '' ? ExitCode.Usage : ExitCode.Ok
  }
  if (args.flags.has('verbose')) {
    logger.setLogLevel('debug')
  }
  try {
    return await dispatch(args)
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : `${cause}`}\n`)
    return isMediaError(cause) ? cause.exitCode : ExitCode.SceneFailed
  }
}

void main().then((code) => {
  process.exitCode = code
})
