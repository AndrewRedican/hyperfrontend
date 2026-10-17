#!/usr/bin/env node
/**
 * Fail a change that would grow the repository with large files.
 *
 * Every committed byte stays in the history each clone downloads, and the
 * hosting service keeps it even after a history rewrite, so the cheap moment to
 * stop a large file is before it lands. Two limits apply to the objects a
 * change adds on top of its base. They are walked across every commit, not the
 * net diff, so a file added and deleted again on the branch still counts.
 *
 * - No single file may exceed `MAX_FILE_BYTES`, whatever its type.
 * - Binary files together may add at most `BUDGET_BYTES`. `--allow-over-budget`
 *   turns an overrun into a warning; in a pull request, the
 *   `binary-budget-approved` label does that.
 *
 * Anything reachable from the base costs nothing, so moving, renaming or
 * restoring a file is free, and so is merging the base in. Written as plain
 * JavaScript with no dependencies so CI runs it without installing the
 * workspace.
 *
 * Usage, from anywhere inside the repository:
 *
 *   node tools/workspace/scripts/check-binary-budget.mjs
 *   node tools/workspace/scripts/check-binary-budget.mjs --staged
 *   node tools/workspace/scripts/check-binary-budget.mjs --base <rev> --allow-over-budget
 *
 * The base defaults to `origin/main`; when that is missing the check measures
 * from HEAD with a warning, so a clone without it can still commit and push.
 * `--staged` also counts the staged changes as the next commit, and holds only
 * what that commit adds to the per-file limit, so commits after an oversized
 * one are not blocked by it; the branch check still is, until the branch
 * history drops the file.
 *
 * Exits 0 within both limits, 1 over a limit, and 2 on bad arguments, an
 * explicit base that is not a commit, or a failing git command.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

/** The most one file may add, in bytes, whatever its type: the media recorder's own ceiling for a GIF. */
const MAX_FILE_BYTES = 2_000_000

/** The most bytes of binary files one change may add before it needs approval. */
const BUDGET_BYTES = 6 * 1024 * 1024

/** File types counted toward the budget: images, video, audio, archives, documents, fonts and WebAssembly. */
const BINARY_FILE =
  /\.(?:avif|bmp|gif|ico|jpe?g|png|tiff?|webp|mkv|mov|mp3|mp4|ogg|wav|webm|7z|gz|tar|tgz|zip|pdf|eot|otf|ttf|woff2?|wasm)$/i

const DEFAULT_BASE = 'origin/main'

const USAGE = 'usage: check-binary-budget.mjs [--base <rev>] [--staged] [--allow-over-budget]'

/** An identity for the throwaway commit that stands in for the staged changes, which git requires even for a commit no ref points at. */
const STAGED_IDENTITY = {
  GIT_AUTHOR_NAME: 'binary-budget',
  GIT_AUTHOR_EMAIL: 'binary-budget@localhost',
  GIT_COMMITTER_NAME: 'binary-budget',
  GIT_COMMITTER_EMAIL: 'binary-budget@localhost',
}

const git = (args, input = '') =>
  execFileSync('git', args, {
    encoding: 'utf8',
    input,
    // why: a long history lists tens of thousands of objects, well past the 1 MiB default
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...STAGED_IDENTITY },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

const fail = (message) => {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

const readOptions = () => {
  try {
    return parseArgs({
      options: {
        base: { type: 'string' },
        staged: { type: 'boolean', default: false },
        'allow-over-budget': { type: 'boolean', default: false },
      },
    }).values
  } catch (error) {
    return fail(`error: ${error.message}\n${USAGE}`)
  }
}

const isCommit = (revision) => {
  try {
    git(['rev-parse', '--verify', '--quiet', `${revision}^{commit}`])
    return true
  } catch {
    return false
  }
}

/** The revision to measure from: an explicit base must exist, and a missing default falls back to HEAD. */
const resolveBase = (requested) => {
  if (isCommit(requested ?? DEFAULT_BASE)) return requested ?? DEFAULT_BASE
  if (requested !== undefined)
    return fail(`error: the base ${requested} is not a commit in this repository; fetch it or pass another --base`)
  process.stderr.write(
    `warning: ${DEFAULT_BASE} is not a commit in this repository, so the check measures from HEAD; fetch it to measure the whole branch\n`
  )
  return 'HEAD'
}

/** Commits the staged changes as a child of HEAD that no ref points at, leaving the branch and the index as they were, and returns its id. */
const commitStaged = () => git(['commit-tree', git(['write-tree']).trim(), '-p', 'HEAD', '-m', 'staged changes']).trim()

/** Every blob reachable from `revision` and from nowhere in the history of `excluded`, with its size and the first path it was found at. */
const newBlobs = (revision, excluded) => {
  // why: `--not` alone only subtracts the trees where the walk stops, so a blob the excluded history held earlier, restored or merged back in, would look new
  const known = new Set(git(['rev-list', '--objects', '--no-object-names', ...excluded, '--']).split(/\r?\n/))
  const candidates = git(['rev-list', '--objects', revision, '--not', ...excluded, '--'])
    .split(/\r?\n/)
    .filter((line) => line !== '' && !known.has(line.split(' ', 1)[0]))
  return git(['cat-file', '--batch-check=%(objecttype) %(objectsize) %(rest)'], candidates.join('\n'))
    .split(/\r?\n/)
    .filter((line) => line.startsWith('blob '))
    .map((line) => {
      const sizeEnd = line.indexOf(' ', 'blob '.length)
      return { bytes: Number(line.slice('blob '.length, sizeEnd)), path: line.slice(sizeEnd + 1) }
    })
}

const mib = (count) => `${(count / (1024 * 1024)).toFixed(2)} MiB`

const exact = (count) => `${count.toLocaleString('en-US')} bytes (${mib(count)})`

const check = () => {
  const options = readOptions()
  const base = resolveBase(options.base)
  const approved = options['allow-over-budget']
  const head = options.staged ? commitStaged() : 'HEAD'
  const added = newBlobs(head, [base])
  const oversized = (options.staged ? newBlobs(head, ['HEAD', base]) : added).filter((blob) => blob.bytes > MAX_FILE_BYTES)
  const binaries = added.filter((blob) => BINARY_FILE.test(blob.path)).sort((a, b) => b.bytes - a.bytes)
  const binaryBytes = binaries.reduce((total, blob) => total + blob.bytes, 0)
  const overBudget = binaryBytes > BUDGET_BYTES

  process.stdout.write(`binary budget against ${base}: ${mib(binaryBytes)} of ${mib(BUDGET_BYTES)}, new binary files: ${binaries.length}\n`)
  for (const blob of binaries) {
    process.stdout.write(`${mib(blob.bytes).padStart(12)}  ${blob.path}\n`)
  }

  for (const blob of oversized) {
    process.stderr.write(
      `error: ${blob.path} is ${exact(blob.bytes)}; no file may exceed ${MAX_FILE_BYTES.toLocaleString('en-US')} bytes. Keep it out of Git, or shrink it.\n`
    )
  }

  if (overBudget) {
    process.stderr.write(
      approved
        ? `warning: this change adds ${exact(binaryBytes)} of binary files, over the budget of ${exact(BUDGET_BYTES)}; a pull request carrying it needs the binary-budget-approved label.\n`
        : `error: this change adds ${exact(binaryBytes)} of binary files, over the budget of ${exact(BUDGET_BYTES)}. If that is intended, label the pull request binary-budget-approved and re-run the check, or pass --allow-over-budget.\n`
    )
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Binary budget',
        '',
        `${mib(binaryBytes)} of ${mib(BUDGET_BYTES)} in ${binaries.length} new binary files. No file may exceed ${MAX_FILE_BYTES.toLocaleString('en-US')} bytes.`,
        '',
        '| Size | File |',
        '| ---: | --- |',
        ...binaries.map((blob) => `| ${mib(blob.bytes)} | \`${blob.path}\` |`),
        '',
      ].join('\n')
    )
  }

  process.exitCode = oversized.length > 0 || (overBudget && !approved) ? 1 : 0
}

try {
  check()
} catch (error) {
  // how: execFileSync puts the failing command and its stderr in the message
  fail(`error: ${error.message.trim()}`)
}
