#!/usr/bin/env node
/**
 * Fail a change that would grow the repository with large files.
 *
 * Every committed byte stays in the history each clone downloads, and the
 * hosting service keeps it even after a history rewrite, so the cheap moment to
 * stop a large file is before it lands. Three limits apply to the objects a
 * change adds on top of its base. They are walked across every commit, not the
 * net diff, so a file added and deleted again on the branch still counts.
 *
 * - No single file may exceed `MAX_FILE_BYTES`, whatever its type.
 * - Binary files together may be charged at most `BUDGET_BYTES`. What a file is
 *   charged depends on what it does to the repository:
 *   - A new file is charged its size.
 *   - A file that takes the place of one the base holds is charged only what it
 *     adds over that file: a recording made again, a vendored archive packed
 *     again. The file it replaces is the one at the same path, or one the
 *     change removes from the same directory whose name differs only in its
 *     version number (`shell-0.3.0.tgz` giving way to `shell-0.4.0.tgz`).
 *   - A file the change added and no longer holds, an earlier take of a
 *     recording, is charged its size: no checkout uses it.
 * - Binary files together, replacements at their full size, may add at most
 *   `HISTORY_CEILING_BYTES`: a replacement is still downloaded by every clone,
 *   so replacing is cheap but not free without end.
 *
 * `--allow-over-budget` turns an overrun of the budget or the ceiling into a
 * warning; in a pull request, the `binary-budget-approved` label does that.
 *
 * Anything reachable from the base costs nothing, so moving, renaming or
 * restoring a file is free, and so is merging the base in. Written as plain
 * JavaScript with no dependencies so CI runs it without installing the
 * workspace.
 *
 * Usage, from anywhere inside the repository:
 *
 *   node tools/pipeline/scripts/check-binary-budget.mjs
 *   node tools/pipeline/scripts/check-binary-budget.mjs --staged
 *   node tools/pipeline/scripts/check-binary-budget.mjs --base <rev> --allow-over-budget
 *
 * The base defaults to `origin/main`; when that is missing the check measures
 * from HEAD with a warning, so a clone without it can still commit and push.
 * `--staged` also counts the staged changes as the next commit, and holds only
 * what that commit adds to the per-file limit, so commits after an oversized
 * one are not blocked by it; the branch check still is, until the branch
 * history drops the file.
 *
 * Exits 0 within every limit, 1 over a limit, and 2 on bad arguments, an
 * explicit base that is not a commit, or a failing git command.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { posix } from 'node:path'
import { parseArgs } from 'node:util'

/** The most one file may add, in bytes, whatever its type: the media recorder's own ceiling for a GIF. */
const MAX_FILE_BYTES = 2_000_000

/** The most bytes of binary files one change may be charged before it needs approval. */
const BUDGET_BYTES = 2 * 1024 * 1024

/** The most bytes of binary files one change may add to the history before it needs approval, replacements counted at their full size. */
const HISTORY_CEILING_BYTES = 4 * BUDGET_BYTES

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

/** Every blob reachable from `revision` and from nowhere in the history of `excluded`, with its id, its size and the first path it was found at. */
const newBlobs = (revision, excluded) => {
  // why: `--not` alone only subtracts the trees where the walk stops, so a blob the excluded history held earlier, restored or merged back in, would look new
  const known = new Set(git(['rev-list', '--objects', '--no-object-names', ...excluded, '--']).split(/\r?\n/))
  const candidates = git(['rev-list', '--objects', revision, '--not', ...excluded, '--'])
    .split(/\r?\n/)
    .filter((line) => line !== '' && !known.has(line.split(' ', 1)[0]))
  return git(['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'], candidates.join('\n'))
    .split(/\r?\n/)
    .filter((line) => line.startsWith('blob '))
    .map((line) => {
      const idEnd = line.indexOf(' ', 'blob '.length)
      const sizeEnd = line.indexOf(' ', idEnd + 1)
      return { id: line.slice('blob '.length, idEnd), bytes: Number(line.slice(idEnd + 1, sizeEnd)), path: line.slice(sizeEnd + 1) }
    })
}

/** The binary files of a revision's tree: the size of each by path, and the paths holding each blob. */
const binaryTree = (revision) => {
  const sizes = new Map()
  const paths = new Map()
  for (const entry of git(['ls-tree', '-r', '-l', '-z', revision]).split('\0')) {
    const tab = entry.indexOf('\t')
    const path = entry.slice(tab + 1)
    if (tab === -1 || !BINARY_FILE.test(path)) continue
    const [, type, id, size] = entry.slice(0, tab).split(/ +/)
    if (type !== 'blob') continue
    sizes.set(path, Number(size))
    paths.set(id, [...(paths.get(id) ?? []), path])
  }
  return { sizes, paths }
}

/** A path with the version number in its file name blanked, so two releases of one archive share a key. */
const versionless = (path) => {
  const extension = BINARY_FILE.exec(path)[0]
  // why: Git names a path with forward slashes on every platform
  const stem = posix.basename(path, extension).replace(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]*)?/g, '*')
  return posix.join(posix.dirname(path), stem + extension)
}

/** For each binary path only the head holds, the path it takes over from: one only the base holds, in the same directory, under the same name but for its version number. */
const successions = (baseTree, headTree) => {
  const vacated = new Map()
  for (const path of [...baseTree.sizes.keys()].sort()) {
    if (!headTree.sizes.has(path)) vacated.set(versionless(path), [...(vacated.get(versionless(path)) ?? []), path])
  }
  const replaced = new Map()
  for (const path of [...headTree.sizes.keys()].sort()) {
    if (baseTree.sizes.has(path)) continue
    // why: each vacated path is taken once, so two new files cannot both be measured against one removed file
    const predecessor = vacated.get(versionless(path))?.shift()
    if (predecessor !== undefined) replaced.set(path, predecessor)
  }
  return replaced
}

/**
 * What each new binary blob is charged against the budget, largest first.
 * A blob the head holds is measured at the path that charges it least, since Git stores identical copies once.
 */
const chargeBinaries = (added, baseTree, headTree) => {
  const replaced = successions(baseTree, headTree)
  const atPath = (blob, path) => {
    const predecessor = baseTree.sizes.has(path) ? path : replaced.get(path)
    if (predecessor === undefined) return { ...blob, path, kind: 'new', charged: blob.bytes }
    return { ...blob, path, kind: 'replaces', charged: Math.max(0, blob.bytes - baseTree.sizes.get(predecessor)), predecessor }
  }
  return added
    .flatMap((blob) => {
      const held = headTree.paths.get(blob.id)
      if (held !== undefined) return [held.map((path) => atPath(blob, path)).sort((a, b) => a.charged - b.charged)[0]]
      return BINARY_FILE.test(blob.path) ? [{ ...blob, kind: 'superseded', charged: blob.bytes }] : []
    })
    .sort((a, b) => b.charged - a.charged || b.bytes - a.bytes)
}

/** How a charged file reads in the report: what it replaces when that is another path, or that the change no longer holds it. */
const describe = (binary) => {
  if (binary.kind === 'superseded') return `${binary.path} (no longer in the change)`
  if (binary.kind === 'replaces' && binary.predecessor !== binary.path) return `${binary.path} (replaces ${binary.predecessor})`
  return binary.path
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
  const binaries = chargeBinaries(added, binaryTree(base), binaryTree(head))
  const chargedBytes = binaries.reduce((total, binary) => total + binary.charged, 0)
  const addedBytes = binaries.reduce((total, binary) => total + binary.bytes, 0)
  const overBudget = chargedBytes > BUDGET_BYTES
  const overCeiling = addedBytes > HISTORY_CEILING_BYTES
  const remedy = approved
    ? 'a pull request carrying it needs the binary-budget-approved label.'
    : 'If that is intended, label the pull request binary-budget-approved and re-run the check, or pass --allow-over-budget.'

  process.stdout.write(
    `binary budget against ${base}: ${mib(chargedBytes)} of ${mib(BUDGET_BYTES)} charged, ${mib(addedBytes)} of ${mib(HISTORY_CEILING_BYTES)} added to the history, new binary files: ${binaries.length}\n`
  )
  if (binaries.length > 0) process.stdout.write(`${'charged'.padStart(12)}${'size'.padStart(12)}\n`)
  for (const binary of binaries) {
    process.stdout.write(
      `${mib(binary.charged).padStart(12)}${mib(binary.bytes).padStart(12)}  ${binary.kind.padEnd(10)}  ${describe(binary)}\n`
    )
  }

  for (const blob of oversized) {
    process.stderr.write(
      `error: ${blob.path} is ${exact(blob.bytes)}; no file may exceed ${MAX_FILE_BYTES.toLocaleString('en-US')} bytes. Keep it out of Git, or shrink it.\n`
    )
  }

  if (overBudget) {
    process.stderr.write(
      `${approved ? 'warning' : 'error'}: this change is charged ${exact(chargedBytes)} of binary files, over the budget of ${exact(BUDGET_BYTES)}; ${approved ? remedy : `a file that replaces another is charged only its growth. ${remedy}`}\n`
    )
  }

  if (overCeiling) {
    process.stderr.write(
      `${approved ? 'warning' : 'error'}: this change adds ${exact(addedBytes)} of binary files to the history, replacements included, over the ceiling of ${exact(HISTORY_CEILING_BYTES)}${approved ? '; ' : '. '}${remedy}\n`
    )
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Binary budget',
        '',
        `${mib(chargedBytes)} of ${mib(BUDGET_BYTES)} charged and ${mib(addedBytes)} of ${mib(HISTORY_CEILING_BYTES)} added to the history, in ${binaries.length} new binary files. A file that replaces another is charged only its growth. No file may exceed ${MAX_FILE_BYTES.toLocaleString('en-US')} bytes.`,
        '',
        '| Charged | Size | Kind | File |',
        '| ---: | ---: | --- | --- |',
        ...binaries.map((binary) => `| ${mib(binary.charged)} | ${mib(binary.bytes)} | ${binary.kind} | \`${describe(binary)}\` |`),
        '',
      ].join('\n')
    )
  }

  process.exitCode = oversized.length > 0 || ((overBudget || overCeiling) && !approved) ? 1 : 0
}

try {
  check()
} catch (error) {
  // how: execFileSync puts the failing command and its stderr in the message
  fail(`error: ${error.message.trim()}`)
}
