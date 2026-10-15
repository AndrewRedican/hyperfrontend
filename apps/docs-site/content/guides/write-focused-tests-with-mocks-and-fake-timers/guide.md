# How to write focused tests with mocks, fake timers and module replacements

You will write specs that each pin one observable fact about the code, using the mock functions, spies, module replacements, fake clock and promise matchers of [`@hyperfrontend/testing`](/docs/libraries/testing), and every one of them will fail for exactly the reason its name gives.

A test that checks one fact fails with one message, and the message is the diagnosis. A test that checks five facts stops at the first failure and hides the other four, and its name has to be vague enough to cover all five. That is the whole case for one assertion per test. It is a discipline about facts rather than about the `expect` keyword: asserting over a collection, or over two values that only mean something together, is still one fact and is fine as two calls, and the asymmetric matchers below exist so that one `toEqual` can describe the shape of a whole result.

The examples are a shopping cart, a polling helper and a feature-flag module, and every spec here ran against the published package on the date in the badge above.

## 1. Pin one fact per test

The cart prices its lines through a `pricing` module and reports each change to subscribers. The first spec replaces the price list, which the next step explains, and then states one fact per test:

```typescript
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createCart } from './cart'

jest.mock('./pricing', () => {
  const actual = jest.requireActual('./pricing') as typeof import('./pricing')
  return { ...actual, priceOf: (sku: string) => (sku === 'tea' ? 3 : 5) }
})

describe('cart', () => {
  it('totals the priced lines', () => {
    const cart = createCart()
    cart.add('tea', 2)
    expect(cart.total()).toBe(6)
  })

  it('keeps the currency the real module reports', () => {
    const cart = createCart()
    cart.subscribe((state) => expect(state.currency).toBe('EUR'))
    cart.add('tea', 1)
  })
})
```

Each title is a sentence the failure output completes. When `totals the priced lines` fails, the diff shows the wrong total and nothing else, which is the point of keeping the currency in a test of its own.

## 2. Assert on a shape, not a field at a time

A result with several interesting properties tempts a run of `expect` calls, one per property. One [`toEqual`](/docs/libraries/testing#api-Assertions) with [`expect.objectContaining`](/docs/libraries/testing#api-expect) and [`expect.arrayContaining`](/docs/libraries/testing#api-expect) says the same thing as a single fact, and the failure prints the whole received shape against the whole expected one:

```typescript
it('reports each change as one state', () => {
  const cart = createCart()
  const onChange = jest.fn()
  cart.subscribe(onChange)
  cart.add('tea', 1)
  cart.add('coffee', 2)
  expect(onChange.mock.calls).toEqual([
    [expect.objectContaining({ total: 3 })],
    [
      expect.objectContaining({
        total: 13,
        lines: expect.arrayContaining([{ sku: 'coffee', quantity: 2 }]),
      }),
    ],
  ])
})
```

[`jest.fn`](/docs/libraries/testing#api-JestApi) returns a [`MockFn`](/docs/libraries/testing#api-MockFn) whose [`mock`](/docs/libraries/testing#api-MockState) record holds every call's arguments, so a list of calls is a value to compare like any other. `objectContaining` ignores the properties it does not name, which is what keeps this test from breaking when a new field joins the state.

## 3. Replace a module the code imports

The first spec's [`jest.mock`](/docs/libraries/testing#api-JestApi) call is read out of the file before its imports link, so the cart binds to the replacement even though the declaration sits below the import. The factory spreads [`jest.requireActual`](/docs/libraries/testing#api-JestApi) and overrides one export; the rest stay real, and `currency` in the first spec came from the real module. A factory that names only some exports leaves the others real in any case, so the spread is for the reader rather than the loader.

The automock form replaces every export with a fresh mock function:

```typescript
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createCart } from './cart'
import { currency, priceOf } from './pricing'

jest.mock('./pricing')

describe('cart with an automocked price list', () => {
  it('starts with every export replaced by a mock that returns undefined', () => {
    expect(currency()).toBeUndefined()
  })

  it('prices from the queued value', () => {
    jest.mocked(priceOf).mockReturnValue(2)
    const cart = createCart()
    cart.add('anything', 4)
    expect(cart.total()).toBe(8)
  })
})
```

[`jest.mocked`](/docs/libraries/testing#api-JestApi) only narrows the type, so `priceOf` gets the [`mockReturnValue`](/docs/libraries/testing#api-MockFn) surface in the editor; at runtime the import already is the mock.

## 4. Spy on what you do not own

[`jest.spyOn`](/docs/libraries/testing#api-JestApi) replaces a method with a mock that calls through until told otherwise, and [`jest.restoreAllMocks`](/docs/libraries/testing#api-JestApi) in an `afterEach` puts every original back so no spy outlives its test:

```typescript
import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'

const audit = {
  record(event: string): string {
    return `recorded ${event}`
  },
  warn(event: string): void {
    console.warn(event)
  },
}

describe('spies', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('calls through until told otherwise', () => {
    const record = jest.spyOn(audit, 'record')
    audit.record('login')
    expect(record).toHaveBeenCalledWith('login')
  })

  it('replaces the result for one call', () => {
    jest.spyOn(audit, 'record').mockReturnValueOnce('skipped')
    expect([audit.record('a'), audit.record('b')]).toEqual(['skipped', 'recorded b'])
  })

  it('silences a console method for the test', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    audit.warn('disk nearly full')
    expect(warn).toHaveBeenCalledWith('disk nearly full')
  })
})
```

A spy needs an object to install on. An ES module namespace is sealed and importers bind its names at link time, so a function imported from another module is replaced with [`jest.mock`](/docs/libraries/testing#api-JestApi) and a factory, as in the previous step, never with a spy.

## 5. Control the clock

`pollUntil` calls a check, and when it fails schedules the next call after the next delay in its list. With [`jest.useFakeTimers`](/docs/libraries/testing#api-JestApi) installed in a `beforeEach`, the test decides how far time moves:

```typescript
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { pollUntil } from './poll'

describe('pollUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-03-01T09:00:00Z') })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not poll again before the first delay has passed', () => {
    const check = jest.fn().mockReturnValue(false)
    pollUntil(check, [100, 200], () => undefined)
    jest.advanceTimersByTime(99)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('polls again once the delay has passed', () => {
    const check = jest.fn().mockReturnValue(false)
    pollUntil(check, [100, 200], () => undefined)
    jest.advanceTimersByTime(100)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('runs the whole cascade in one call', () => {
    const check = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true)
    const onDone = jest.fn()
    pollUntil(check, [100, 200, 400], onDone)
    jest.runAllTimers()
    expect(onDone).toHaveBeenCalledWith(2)
  })

  it('reads the pinned clock through Date', () => {
    jest.setSystemTime(new Date('2026-03-01T09:30:00Z'))
    expect(new Date().toISOString()).toBe('2026-03-01T09:30:00.000Z')
  })
})
```

The clock is Node's own, so [`advanceTimersByTime`](/docs/libraries/testing#api-JestApi) fires exactly what falls inside the window and nothing else. [`runAllTimers`](/docs/libraries/testing#api-JestApi) keeps draining until no timeout is pending, which carries a timer that schedules a timer through in one call. When a timer's callback awaits something, use [`advanceTimersByTimeAsync`](/docs/libraries/testing#api-JestApi), which yields one microtask turn after advancing so the promise work the timers started settles before the assertion. [`useRealTimers`](/docs/libraries/testing#api-JestApi) in an `afterEach` is not optional: a fake clock left installed stalls every later test that waits on a real timer.

## 6. Re-evaluate a module with different inputs

A module that reads its configuration when it loads cannot be tested through its exports alone, because the import has already happened. [`jest.resetModules`](/docs/libraries/testing#api-JestApi) makes the next dynamic import evaluate the module again, and a [`jest.doMock`](/docs/libraries/testing#api-JestApi) declared after the reset is what that evaluation sees:

```typescript
import { describe, expect, it, jest } from '@hyperfrontend/testing'

describe('flags read at module load', () => {
  it('reflects the source the module was evaluated against', async () => {
    jest.resetModules()
    jest.doMock('./source', () => ({ readFlags: () => ['beta-search'] }))
    const { enabled } = await import('./flags')
    expect([...enabled]).toEqual(['beta-search'])
  })

  it('evaluates again for the next declaration', async () => {
    jest.resetModules()
    jest.doMock('./source', () => ({ readFlags: () => [] }))
    const { enabled } = await import('./flags')
    expect(enabled.size).toBe(0)
  })
})
```

The order is the contract: reset, then declare, then import dynamically. A `doMock` reaches only modules imported after it, never ones already linked, so a static import at the top of the spec would bind the real `flags` and the test would be asserting on the wrong module.

## 7. Assert on promises

[`resolves`](/docs/libraries/testing#api-Expectation) and [`rejects`](/docs/libraries/testing#api-Expectation) await the subject and then apply any matcher, so an asynchronous fact reads like a synchronous one. For a `try` and `catch` written by hand, [`expect.assertions`](/docs/libraries/testing#api-expect) is what fails the test when the `catch` block never runs:

```typescript
import { describe, expect, it } from '@hyperfrontend/testing'
import { fetchUser } from './users'

describe('fetchUser', () => {
  it('resolves to the user', async () => {
    await expect(fetchUser(7)).resolves.toEqual(expect.objectContaining({ id: 7 }))
  })

  it('rejects an id below one', async () => {
    await expect(fetchUser(0)).rejects.toThrow(RangeError)
  })

  it('fails if the catch block never runs', async () => {
    expect.assertions(1)
    try {
      await fetchUser(0)
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError)
    }
  })
})
```

The count is checked by the package's [`it`](/docs/libraries/testing#api-it) once the body settles, which is why `it` comes from the package even in files that use no other modifier.

## Check it worked

Run the specs and then break the code, one change at a time. Make the cart ignore quantity: exactly one test fails, `totals the priced lines`, with `6` expected and `3` received, and the subscriber test still passes. Make `pollUntil` schedule its first retry without a delay: `does not poll again before the first delay has passed` fails on a call count of two, and the cascade test still passes. Remove the `throw` from `fetchUser`: `rejects an id below one` fails because the promise resolved, and `fails if the catch block never runs` fails with zero assertions against the one it declared. Each failure names one fact, which is what the discipline buys.
