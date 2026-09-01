import type { TestContext } from 'node:test'
import type { EachRow } from './each'
import { describe as nodeDescribe, it as nodeIt } from 'node:test'
import { resetAssertionCount, verifyAssertionCount } from '../expect/expectation'
import { formatTitle, rowArguments } from './each'

/**
 * A test body, in either the returning or the `done`-callback style.
 */
export type TestBody = (done: (error?: unknown) => void) => unknown

/**
 * A suite body.
 */
export type SuiteBody = () => void

/**
 * A parameterised runner produced by `.each`.
 */
export type EachRunner = (title: string, body: (...args: any[]) => unknown, timeoutMs?: number) => void

/**
 * The `it` surface, including the modifiers `node:test` does not provide.
 *
 * The optional trailing number is Jest's per-test timeout in milliseconds; it overrides
 * the runner's `--test-timeout` default for that one test.
 */
export type ItApi = {
  (title: string, body: TestBody, timeoutMs?: number): void
  /** Runs only this test, when the runner is started with `--test-only`. */
  only(title: string, body: TestBody, timeoutMs?: number): void
  /** Skips this test. */
  skip(title: string, body?: TestBody): void
  /** Records the test as pending work. Any body is ignored, as it is under Jest. */
  todo(title: string): void
  /** Runs this test concurrently with its siblings. */
  concurrent(title: string, body: TestBody, timeoutMs?: number): void
  /** Passes only when the body fails, used to pin a known defect. */
  failing(title: string, body: TestBody): void
  /** Runs the test once per row of the table. */
  each(table: readonly unknown[]): EachRunner
}

/**
 * The `describe` surface, including the modifiers `node:test` does not provide.
 */
export type DescribeApi = {
  (title: string, body: SuiteBody): void
  /** Runs only this suite, when the runner is started with `--test-only`. */
  only(title: string, body: SuiteBody): void
  /** Skips this suite. */
  skip(title: string, body?: SuiteBody): void
  /** Declares the suite once per row of the table. */
  each(table: readonly unknown[]): (title: string, body: (...args: any[]) => void) => void
}

/**
 * A test body in the shape `node:test` invokes.
 */
type NodeTestBody = (context: TestContext, done: (result?: unknown) => void) => void | Promise<void>

/**
 * Adapts a test body to the signature `node:test` calls it with.
 *
 * `node:test` passes a test context first and the completion callback second; the suites
 * were written against Jest, which passes only the callback. A body declaring no
 * parameters is wrapped so the assertion count declared by `expect.assertions` is
 * checked once it settles.
 *
 * @param body - The test body as authored.
 * @returns A body `node:test` can invoke directly.
 */
function adaptBody(body: TestBody): NodeTestBody {
  if (body.length === 0) {
    return async () => {
      resetAssertionCount()
      await (body as unknown as () => unknown)()
      verifyAssertionCount()
    }
  }

  return (_context, done) => {
    resetAssertionCount()
    body(done)
  }
}

/**
 * Renders a per-test timeout as `node:test` options.
 *
 * @param timeoutMs - Jest's optional trailing timeout argument.
 * @returns The options to spread into the declaration.
 */
function timeoutOptions(timeoutMs?: number): { timeout?: number } {
  return timeoutMs === undefined ? {} : { timeout: timeoutMs }
}

/**
 * Builds a parameterised runner over a table.
 *
 * @param declare - How to register one case, given its rendered title, bound body, and timeout.
 * @returns A `.each` implementation.
 */
function buildEach(declare: (title: string, body: () => unknown, timeoutMs?: number) => void): (table: readonly unknown[]) => EachRunner {
  return (table) => (title, body, timeoutMs) => {
    table.forEach((row, index) => {
      const args: EachRow = rowArguments(row)
      declare(formatTitle(title, args, index), () => body(...args), timeoutMs)
    })
  }
}

/**
 * `it`, with the Jest modifiers the workspace's suites use.
 *
 * Import this instead of `node:test`'s `it` only in files that need `.each`, `.failing`,
 * `.concurrent`, the `done` callback, or `expect.assertions`. Everywhere else, importing
 * straight from `node:test` keeps the spec closer to the platform.
 */
export const it: ItApi = Object.assign(
  (title: string, body: TestBody, timeoutMs?: number): void => {
    nodeIt(title, timeoutOptions(timeoutMs), adaptBody(body))
  },
  {
    only: (title: string, body: TestBody, timeoutMs?: number): void => {
      nodeIt(title, { only: true, ...timeoutOptions(timeoutMs) }, adaptBody(body))
    },
    skip: (title: string, body?: TestBody): void => {
      nodeIt(title, { skip: true }, body ? adaptBody(body) : () => undefined)
    },
    // why: Jest only records the pending marker and never runs a body, while `node:test` would run it and report the outcome.
    todo: (title: string): void => {
      nodeIt(title, { todo: true }, () => undefined)
    },
    concurrent: (title: string, body: TestBody, timeoutMs?: number): void => {
      nodeIt(title, { concurrency: true, ...timeoutOptions(timeoutMs) }, adaptBody(body))
    },
    failing: (title: string, body: TestBody): void => {
      nodeIt(title, async () => {
        let passed = false
        try {
          await (body as unknown as () => unknown)()
          passed = true
        } catch {
          // why: the failure is the point; a body pinned as failing is expected to throw.
        }
        if (passed) throw new Error(`expected "${title}" to fail, it passed`)
      })
    },
    each: buildEach((title, body, timeoutMs) => {
      nodeIt(title, timeoutOptions(timeoutMs), adaptBody(body as TestBody))
    }),
  }
)

/**
 * `describe`, with the Jest modifiers the workspace's suites use.
 */
export const describe: DescribeApi = Object.assign(
  (title: string, body: SuiteBody): void => {
    nodeDescribe(title, body)
  },
  {
    only: (title: string, body: SuiteBody): void => {
      nodeDescribe(title, { only: true }, body)
    },
    skip: (title: string, body?: SuiteBody): void => {
      nodeDescribe(title, { skip: true }, body ?? (() => undefined))
    },
    each: buildEach((title, body) => {
      nodeDescribe(title, body as SuiteBody)
    }),
  }
)
