# no-sleep-before-call-assertion

Wait for the work itself, not a fixed stretch of real time, before asserting that a mock was called.

## Rule Details

A spec that sleeps 20 or 50 milliseconds and then expects a callback to have run is guessing how
long the code under test takes. The guess holds on an idle laptop and fails on a CI runner busy
with other jobs. `@hyperfrontend/testing` gives waits that do not depend on machine speed:

- `flushPromises()` resolves after every promise callback already queued has run, so code that
  advances on promise settlement alone has finished by then;
- `waitFor(() => expect(…))` and `waitUntil(condition)` retry until the assertion holds or the
  condition is true, within a timeout;
- the fake clock (`jest.useFakeTimers()`, `jest.advanceTimersByTime`) moves time for code that
  schedules timers.

The rule reports, in a spec, an awaited delay that a later statement of the same block follows
with a call assertion:

- the delay is `await sleep(…)`, called bare or off an object, or an awaited `new Promise` whose
  executor calls `setTimeout`, bare or off an object such as `realTimers`;
- the call assertion is `expect(…)` followed by `toHaveBeenCalled`, `toHaveBeenCalledWith`,
  `toHaveBeenCalledTimes`, `toHaveBeenLastCalledWith` or `toHaveBeenNthCalledWith`, through any
  modifier except `.not`.

Every delay before the first call assertion is reported once. These are left alone:

- a negated assertion and `toHaveBeenCalledTimes(0)`: a fixed wait is a fair way to show that
  something did not happen;
- an assertion inside a nested function, such as the callback of `waitFor`;
- value assertions such as `toBe` or `toEqual`: the rule cannot tell a check that something
  happened from a check that it did not.

The rule does not fix: which wait replaces the delay depends on whether the code under test runs
on promises, timers or outside events.

### Why?

- **Fewer false failures.** A fixed delay fails when the runner is slow, and a slow runner is the
  normal state of a CI machine running many jobs.
- **Faster suites.** `flushPromises` takes one turn of the event loop; `waitFor` returns as soon as
  the assertion holds.

## Options

None.

## Examples

### ❌ Incorrect

```typescript
it('hands each frame to the handler', async () => {
  const handler = jest.fn()
  const queue = createQueue(async (frame) => handler(frame))
  queue.addMessage(frame)
  await sleep(50)
  expect(handler).toHaveBeenCalledWith(frame)
})
```

**Error**: `Wait for the work itself rather than a fixed delay before asserting a call: flushPromises for promise chains, waitFor or waitUntil for a condition, the fake clock for timers.`

### ✅ Correct

```typescript
it('hands each frame to the handler', async () => {
  const handler = jest.fn()
  const queue = createQueue(async (frame) => handler(frame))
  queue.addMessage(frame)
  await flushPromises()
  expect(handler).toHaveBeenCalledWith(frame)
})
```

```typescript
it('holds sealed traffic while the transport is stopped', async () => {
  transport.stop()
  channel.send('PING')
  await sleep(50)
  expect(postMessage).not.toHaveBeenCalled()
})
```

## Configuration

Enabled from `lint.base.config.ts` for every spec:

```js
{
  files: ['**/*.spec.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
  rules: on('one-assertion-per-test workspace/no-sleep-before-call-assertion'),
}
```

## Related Rules

- [no-mkdtemp-in-tests](./no-mkdtemp-in-tests.md): specs take temporary directories from
  `@hyperfrontend/testing/fs`
