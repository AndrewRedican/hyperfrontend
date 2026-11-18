#!/usr/bin/env node
/**
 * Fail a lockfile whose dependencies carry a security advisory, apart from the
 * advisories the workspace has recorded an exception for.
 *
 * `npm audit` has one dial, a severity floor, and no way to say "this one
 * advisory, for now". When an advisory has no patched release there is nothing
 * to upgrade to and nothing to override with, and the only moves the dial
 * offers are to stay red or to stop looking at every advisory of that severity.
 * This check reads the same report and adds the missing move: an advisory named
 * in `audit-exceptions.json`, with the reason it cannot be fixed and the day the
 * exception ends, no longer fails the gate. Every other advisory still does.
 *
 * An exception is a debt with a due date, and the check collects it:
 *
 * - Past its `until` day the advisory fails again, and the message says to look
 *   for a patched release before renewing.
 * - An exception scoped to named roots fails once its advisory is gone from one
 *   of them, because the entry has done its work and should be deleted.
 * - Every run that an exception excuses prints it, with its reason and its
 *   last day, so it is never out of sight.
 *
 * Written as plain JavaScript with no dependencies so CI runs it without
 * installing the workspace.
 *
 * Usage, from anywhere inside the repository:
 *
 *   node tools/pipeline/scripts/audit.mjs
 *   node tools/pipeline/scripts/audit.mjs --root apps/docs-site --level high
 *
 * `--root` is the directory holding the lockfile, relative to the repository
 * root, and defaults to the root itself. `--level` is the lowest severity that
 * fails: `low`, `moderate` (the default), `high` or `critical`.
 *
 * Exits 0 when nothing at or above the level is left outside the exceptions, 1
 * when something is, when an exception has expired or outlived its advisory, and
 * 2 on bad arguments, an unreadable exceptions file, or an audit that could not
 * be run.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, posix, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** The severities npm reports, lowest first; an advisory fails at or above the requested one. */
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical']

/** The repository root, found from this file so the check runs the same from any directory. */
const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Where the exceptions are recorded, relative to the repository root. */
const EXCEPTIONS_FILE = 'audit-exceptions.json'

const USAGE = 'usage: audit.mjs [--root <directory>] [--level low|moderate|high|critical]'

const fail = (message) => {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

const readOptions = () => {
  try {
    const { values } = parseArgs({ options: { root: { type: 'string', default: '.' }, level: { type: 'string', default: 'moderate' } } })
    if (!SEVERITIES.includes(values.level) || values.level === 'info') return fail(`error: ${values.level} is not a level\n${USAGE}`)
    return values
  } catch (error) {
    return fail(`error: ${error.message}\n${USAGE}`)
  }
}

/** A root as the exceptions file writes it: relative to the repository, forward slashes, `.` for the repository itself. */
const rootName = (root) => {
  const name = normalize(root).split(sep).join(posix.sep).replace(/\/+$/, '')
  return name === '' ? '.' : name
}

/** The recorded exceptions, each checked for the fields that make it a debt someone can settle. */
const readExceptions = () => {
  const file = join(REPOSITORY, EXCEPTIONS_FILE)
  if (!existsSync(file)) return []
  let listed
  try {
    listed = JSON.parse(readFileSync(file, 'utf8')).exceptions
  } catch (error) {
    return fail(`error: ${EXCEPTIONS_FILE} could not be read: ${error.message}`)
  }
  if (!Array.isArray(listed)) return fail(`error: ${EXCEPTIONS_FILE} must hold an "exceptions" array`)
  for (const exception of listed) {
    const named = `${EXCEPTIONS_FILE}: the exception for ${exception?.advisory ?? 'an unnamed advisory'}`
    for (const field of ['advisory', 'package', 'reason', 'resolve', 'until']) {
      if (typeof exception?.[field] !== 'string' || exception[field] === '') return fail(`error: ${named} needs a "${field}"`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.until)) return fail(`error: ${named} needs "until" as a day, YYYY-MM-DD`)
    if (exception.roots !== undefined && !(Array.isArray(exception.roots) && exception.roots.every((root) => typeof root === 'string'))) {
      return fail(`error: ${named} needs "roots" as a list of directories, or none`)
    }
  }
  return listed
}

/** What npm reports for the lockfile in a directory, whatever exit code the findings gave it. */
const runAudit = (directory) => {
  // why: on Windows npm is a command script, which only a shell can start
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    return fail(`error: npm audit gave no report in ${directory}\n${result.stderr || result.error?.message || result.stdout}`)
  }
  if (report.error !== undefined) return fail(`error: npm audit failed in ${directory}: ${report.error.summary ?? report.error.code}`)
  return report
}

/** The id an advisory's page carries, which is the name an exception knows it by. */
const advisoryId = (url) => url.slice(url.lastIndexOf('/') + 1)

/**
 * The advisories of a report, each once, with every package it reaches.
 *
 * npm lists a package once per advisory against it and once more for every
 * package that depends on a vulnerable one, naming the dependency instead of
 * the advisory. Following those names back gives each advisory the packages
 * that are only vulnerable through it.
 */
const advisoriesOf = (report) => {
  const packages = report.vulnerabilities ?? {}
  const found = new Map()
  const sourcesOf = (name, seen = new Set()) => {
    if (seen.has(name)) return []
    seen.add(name)
    return (packages[name]?.via ?? []).flatMap((via) => (typeof via === 'string' ? sourcesOf(via, seen) : [via]))
  }
  for (const name of Object.keys(packages)) {
    for (const source of sourcesOf(name)) {
      const id = advisoryId(source.url)
      const advisory = found.get(id) ?? {
        id,
        package: source.name,
        severity: source.severity,
        title: source.title,
        url: source.url,
        reaches: new Set(),
      }
      advisory.reaches.add(name)
      found.set(id, advisory)
    }
  }
  return [...found.values()]
}

const { root, level } = readOptions()
const name = rootName(root)
const today = new Date().toISOString().slice(0, 10)
const exceptions = readExceptions().filter((exception) => exception.roots === undefined || exception.roots.map(rootName).includes(name))
const advisories = advisoriesOf(runAudit(join(REPOSITORY, root)))

const lines = []
const failures = []
let excused = 0

for (const advisory of advisories) {
  const exception = exceptions.find((candidate) => candidate.advisory === advisory.id)
  const described = `${advisory.id} ${advisory.package} (${advisory.severity}): ${advisory.title}`
  if (exception !== undefined && exception.until >= today) {
    excused += 1
    lines.push(`  excepted until ${exception.until}  ${described}`, `    ${exception.reason}`, `    To settle it: ${exception.resolve}`)
  } else if (SEVERITIES.indexOf(advisory.severity) >= SEVERITIES.indexOf(level)) {
    failures.push(`  ✖ ${described}`, `    ${advisory.url}`, `    reaches: ${[...advisory.reaches].sort().join(', ')}`)
    if (exception !== undefined) {
      failures.push(
        `    Its exception ended on ${exception.until}. Look for a patched release of ${exception.package} first: ${exception.resolve}`,
        `    If there is still none, move "until" forward in ${EXCEPTIONS_FILE}.`
      )
    }
  }
}

for (const exception of exceptions) {
  if (exception.roots === undefined || advisories.some((advisory) => advisory.id === exception.advisory)) continue
  failures.push(
    `  ✖ the exception for ${exception.advisory} (${exception.package}) is no longer needed here: npm reports no such advisory.`,
    `    Remove ${name} from its "roots" in ${EXCEPTIONS_FILE}, or delete the entry when no root is left.`
  )
}

process.stdout.write(`audit of ${name} at ${level}\n`)
if (lines.length > 0) process.stdout.write(`${lines.join('\n')}\n`)
if (failures.length > 0) {
  process.stdout.write(`${failures.join('\n')}\n`)
  process.stderr.write(`audit failed. Run "npm audit" in ${name} for the full report.\n`)
  process.exit(1)
}
process.stdout.write(`  nothing at or above ${level} outside the recorded exceptions${excused > 0 ? ` (${excused} excepted)` : ''}\n`)
