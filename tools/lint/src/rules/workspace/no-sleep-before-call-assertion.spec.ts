import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-sleep-before-call-assertion.ts'

const message =
  'Wait for the work itself rather than a fixed delay before asserting a call: flushPromises for promise chains, waitFor or waitUntil for a condition, the fake clock for timers.'

/**
 * Wraps statements in an async test body, one per line.
 *
 * @param statements - Source lines placed inside the test callback
 * @returns The spec text
 */
const body = (...statements: string[]): string => `it('runs', async () => {\n${statements.map((s) => `  ${s}\n`).join('')}})\n`

/**
 * The error a case's text gives at the nth occurrence of a single-line span.
 *
 * @param text - The case's text
 * @param span - The reported text
 * @param occurrence - Which occurrence, counting from 1
 * @returns The expected error
 */
const at = (
  text: string,
  span: string,
  occurrence = 1
): { message: string; line: number; column: number; endLine: number; endColumn: number } => {
  let offset = -1
  for (let n = 0; n < occurrence; n += 1) offset = text.indexOf(span, offset + 1)
  const before = text.slice(0, offset).split(/\r?\n/)
  const line = before.length
  const column = (before[line - 1] as string).length + 1
  return { message, line, column, endLine: line, endColumn: column + span.length }
}

const SLEEP = 'await sleep(20)'
const TIMEOUT = 'await new Promise((resolve) => setTimeout(resolve, 20))'
const REAL_TIMEOUT = 'await new Promise((resolve) => { realTimers.setTimeout(resolve, 20) })'
const CALLED = 'expect(onSuccess).toHaveBeenCalledWith(packet)'

const sleepThenCalled = body(SLEEP, CALLED)
const timeoutThenTimes = body(TIMEOUT, 'expect(handler).toHaveBeenCalledTimes(1)')
const realTimeoutThenLast = body(REAL_TIMEOUT, 'expect(handler).toHaveBeenLastCalledWith(1)')
const memberSleep = body('await time.sleep(20)', 'expect(handler).toHaveBeenNthCalledWith(1, frame)')
const twoDelays = body(SLEEP, 'queue.resume()', SLEEP, 'expect(handler).toHaveBeenCalled()', 'expect(handler).toHaveBeenCalledTimes(1)')
const nested = body(SLEEP, 'if (ready) {', '  expect(handler).toHaveBeenCalled()', '}')
const resolves = body(SLEEP, 'expect(promise).resolves.toHaveBeenCalled()')
const timesWithoutCount = body(SLEEP, 'expect(handler).toHaveBeenCalledTimes()')

testRule(rule, {
  valid: [
    { name: 'flushPromises before a call assertion', path: '/root/a.spec.ts', text: body('await flushPromises()', CALLED) },
    { name: 'a call assertion inside waitFor after a delay', path: '/root/a.spec.ts', text: body(SLEEP, `await waitFor(() => ${CALLED})`) },
    {
      name: 'a call assertion inside a nested function declaration',
      path: '/root/a.spec.ts',
      text: body(SLEEP, `function check() { ${CALLED} }`),
    },
    {
      name: 'a negated call assertion after a delay',
      path: '/root/a.spec.ts',
      text: body(SLEEP, 'expect(handler).not.toHaveBeenCalled()'),
    },
    { name: 'a zero call count after a delay', path: '/root/a.spec.ts', text: body(SLEEP, 'expect(handler).toHaveBeenCalledTimes(0)') },
    { name: 'a value assertion after a delay', path: '/root/a.spec.ts', text: body(SLEEP, 'expect(held).toBe(false)') },
    { name: 'a delay with nothing after it', path: '/root/a.spec.ts', text: body(CALLED, SLEEP) },
    { name: 'a call assertion with no delay before it', path: '/root/a.spec.ts', text: body('queue.add(frame)', CALLED) },
    { name: 'an awaited call other than sleep', path: '/root/a.spec.ts', text: body('await settle()', CALLED) },
    { name: 'a bracketed sleep', path: '/root/a.spec.ts', text: body("await time['sleep'](20)", CALLED) },
    { name: 'an awaited value', path: '/root/a.spec.ts', text: body('await pending', CALLED) },
    { name: 'an awaited construction other than a promise', path: '/root/a.spec.ts', text: body('await new Gate()', CALLED) },
    { name: 'a promise without an executor', path: '/root/a.spec.ts', text: body('await new Promise()', CALLED) },
    {
      name: 'a promise whose executor sets no timer',
      path: '/root/a.spec.ts',
      text: body('await new Promise((resolve) => queueMicrotask(resolve))', CALLED),
    },
    { name: 'a statement that awaits nothing', path: '/root/a.spec.ts', text: body('sleep(20)', 'const n = 1', CALLED) },
    { name: 'a matcher read off a mock rather than expect', path: '/root/a.spec.ts', text: body(SLEEP, 'handler.toHaveBeenCalled()') },
    { name: 'a matcher read off another call', path: '/root/a.spec.ts', text: body(SLEEP, 'assertThat(handler).toHaveBeenCalled()') },
    { name: 'a bracketed matcher', path: '/root/a.spec.ts', text: body(SLEEP, "expect(handler)['toHaveBeenCalled']()") },
    { name: 'a bracketed modifier', path: '/root/a.spec.ts', text: body(SLEEP, "expect(handler)['not'].toHaveBeenCalled()") },
    { name: 'another matcher', path: '/root/a.spec.ts', text: body(SLEEP, 'expect(handler).toEqual(1)') },
    { name: 'a plain call', path: '/root/a.spec.ts', text: body(SLEEP, 'check()') },
  ],
  invalid: [
    { name: 'sleep before a call assertion', path: '/root/a.spec.ts', text: sleepThenCalled, errors: [at(sleepThenCalled, SLEEP)] },
    {
      name: 'a setTimeout promise before a call count',
      path: '/root/a.spec.ts',
      text: timeoutThenTimes,
      errors: [at(timeoutThenTimes, TIMEOUT)],
    },
    {
      name: 'a member setTimeout promise before a last-call assertion',
      path: '/root/a.spec.ts',
      text: realTimeoutThenLast,
      errors: [at(realTimeoutThenLast, REAL_TIMEOUT)],
    },
    {
      name: 'a member sleep before an nth-call assertion',
      path: '/root/a.spec.ts',
      text: memberSleep,
      errors: [at(memberSleep, 'await time.sleep(20)')],
    },
    {
      name: 'each delay before the first call assertion, once',
      path: '/root/a.spec.ts',
      text: twoDelays,
      errors: [at(twoDelays, SLEEP, 1), at(twoDelays, SLEEP, 2)],
    },
    { name: 'a call assertion nested in a later statement', path: '/root/a.spec.ts', text: nested, errors: [at(nested, SLEEP)] },
    { name: 'a call assertion through a modifier', path: '/root/a.spec.ts', text: resolves, errors: [at(resolves, SLEEP)] },
    {
      name: 'a call count with no argument',
      path: '/root/a.spec.ts',
      text: timesWithoutCount,
      errors: [at(timesWithoutCount, SLEEP)],
    },
  ],
})
