/**
 * Times the linter on fixed inputs and counts its implementation files.
 *
 * @module scripts/lib/bench-main
 */

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { LINT_ROOT, WORKSPACE_ROOT, say } from './paths.ts'

/** One timed case. */
interface BenchCase {
  /** The row label. */
  readonly name: string
  /** The working directory, workspace-relative. */
  readonly cwd: string
  /** The linter's arguments. */
  readonly args: readonly string[]
}

/** The new linter's files by role. */
interface FileCounts {
  /** Implementation files outside `src/rules`, in the package and the workspace layer, fixtures excluded. */
  readonly core: number
  /** Rules and their helpers under `src/rules`. */
  readonly rules: number
  /** Spec files under `src`. */
  readonly specs: number
  /** Files under `scripts`. */
  readonly scripts: number
}

/** The cases, from one file to the whole workspace. */
const CASES: readonly BenchCase[] = [
  { name: 'one package.json', cwd: 'libs/logging', args: ['package.json'] },
  { name: 'one TypeScript file', cwd: 'libs/logging', args: ['src/create-logger.ts'] },
  { name: 'libs/logging', cwd: 'libs/logging', args: ['.'] },
  { name: 'libs/builder', cwd: 'libs/builder', args: ['.'] },
]

/**
 * Runs the script.
 *
 * @param argv - `[--runs n]`, how often each case runs
 */
export function main(argv: readonly string[]): void {
  const option = (name: string, fallback: string): string => {
    const at = argv.indexOf(name)
    return at === -1 ? fallback : (argv[at + 1] ?? fallback)
  }
  const runs = parseInt(option('--runs', '3'), 10)
  say(`| Case | Median of ${runs} |`)
  say('| --- | ---: |')
  for (const benchCase of CASES) {
    const timings: number[] = []
    for (let run = 0; run < runs; run += 1) {
      const started = performance.now()
      spawnSync(process.execPath, [join(LINT_ROOT, 'bin', 'lint.ts'), ...benchCase.args], { cwd: join(WORKSPACE_ROOT, benchCase.cwd) })
      timings.push(performance.now() - started)
    }
    timings.sort((a, b) => a - b)
    say(`| ${benchCase.name} | ${(timings[timings.length >> 1] / 1000).toFixed(2)} s |`)
  }
  const files = implementationFiles()
  say('')
  say(
    `Implementation files under tools/lint/src: ${files.core} outside rules, ${files.rules} rules and rule helpers; ${files.specs} specs; ${files.scripts} script files`
  )
}

/**
 * Counts the new linter's files by role.
 *
 * @returns How many implementation, rule, spec and script files exist
 */
function implementationFiles(): FileCounts {
  const counts = { core: 0, rules: 0, specs: 0, scripts: 0 }
  const list = (dir: string): string[] => {
    try {
      return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join(posix.sep))
    } catch {
      return []
    }
  }
  for (const path of [...list(join(WORKSPACE_ROOT, 'libs', 'linter', 'src')), ...list(join(LINT_ROOT, 'src'))]) {
    if (path.includes('__fixtures__')) continue
    if (path.endsWith('.spec.ts')) counts.specs += 1
    else if (path.startsWith(`rules${posix.sep}`)) counts.rules += 1
    else counts.core += 1
  }
  counts.scripts = list(join(LINT_ROOT, 'scripts')).length
  return counts
}
