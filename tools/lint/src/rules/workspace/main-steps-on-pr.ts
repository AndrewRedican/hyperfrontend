/**
 * Every step the main workflow's environment job runs, the pull-request workflow's environment job
 * runs too, so a check meets its first run before the merge; a step that publishes or reports from
 * main is named in the options instead.
 *
 * @module rules/workspace/main-steps-on-pr
 */

import type { RuleContext, TextDocument } from '@hyperfrontend/linter'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { lineText } from '@hyperfrontend/linter/helpers'

/** The rule's options. */
interface MainStepsOptions {
  /** The names of the steps that run on main alone: they publish, or report what main published. */
  readonly mainOnly?: readonly string[]
}

/** The line that opens the job both workflows run on every leg. */
const JOB = '  environment:'

/** How a named step of that job starts. */
const STEP = '      - name: '

/** The workflow beside the main one that runs on pull requests. */
const PULL_REQUEST_WORKFLOW = 'ci-pr.yml'

/** A named step of the environment job. */
interface Step {
  /** Its name. */
  readonly name: string
  /** The 0-based index of its line. */
  readonly line: number
}

/**
 * The named steps of a workflow's environment job: the job runs from its key to the next line
 * indented less than its body.
 *
 * @param lines - The workflow's lines
 * @returns The steps in order
 */
function environmentSteps(lines: readonly string[]): Step[] {
  const steps: Step[] = []
  let inside = false
  lines.forEach((line, index) => {
    const content = line.trimEnd()
    if (content === JOB) inside = true
    else if (content !== '' && !content.startsWith('   ')) inside = false
    else if (inside && content.startsWith(STEP)) steps.push({ name: content.slice(STEP.length), line: index })
  })
  return steps
}

export default defineRule<MainStepsOptions, TextDocument>({
  id: 'workspace/main-steps-on-pr',
  language: 'text',
  fixable: false,
  create(context: RuleContext<MainStepsOptions, TextDocument>) {
    const counterpart = join(dirname(context.file.path), PULL_REQUEST_WORKFLOW)
    const mainOnly = context.options?.mainOnly ?? []
    return {
      document() {
        const { lines } = context.file
        const main = environmentSteps(lines.starts.map((_, index) => lineText(lines, index + 1)))
        const pullRequest = existsSync(counterpart) ? readFileSync(counterpart, 'utf8').split(/\r?\n/) : []
        const onPullRequests = createSet(environmentSteps(pullRequest).map((step) => step.name))
        for (const step of main) {
          if (onPullRequests.has(step.name) || mainOnly.includes(step.name)) continue
          const start = (lines.starts[step.line] as number) + STEP.length
          context.report({
            start,
            end: start + step.name.length,
            message: `Step '${step.name}' of the environment job runs on main only: add it to the environment job of ${PULL_REQUEST_WORKFLOW} so a pull request runs it first, or list it in mainOnly when it publishes.`,
          })
        }
        const names = createSet(main.map((step) => step.name))
        for (const name of mainOnly) {
          if (!names.has(name)) context.report({ start: 0, message: `mainOnly names '${name}', which is no step of the environment job.` })
          else if (onPullRequests.has(name)) {
            context.report({
              start: 0,
              message: `mainOnly names '${name}', which the environment job of ${PULL_REQUEST_WORKFLOW} runs too.`,
            })
          }
        }
      },
    }
  },
})
