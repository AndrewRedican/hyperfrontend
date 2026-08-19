# How to track an async task without loading flags

You will render a first load, a background refresh, a failure, and a retry as four different screens, from one object, without threading `isLoading` and `error` through your components.

`isLoading` plus `error` is two booleans and four combinations, and none of them remember what happened last time. A refresh looks exactly like a first load, so the spinner covers rows you could have kept on screen; a retry looks exactly like a failure clearing, so the error banner disappears the moment someone clicks it. [`AsyncOperation`](/docs/libraries/state-machine/async-operation#api-AsyncOperation) from [`@hyperfrontend/state-machine`](/docs/libraries/state-machine) derives those distinctions from the dispatches it is already making.

## 1. Install it

```bash
npm install @hyperfrontend/state-machine
```

## 2. Wrap the work

An [`AsyncProcess`](/docs/libraries/state-machine/async-operation#api-AsyncProcess) is a function returning a promise. Throw to report failure:

```ts
import { AsyncOperation } from '@hyperfrontend/state-machine/async-operation'

const operation = new AsyncOperation(loadOrders)
```

Call [`start`](/docs/libraries/state-machine/async-operation#api-AsyncOperation) whenever the work should run: on mount, on a refresh button, on a retry. The same call covers all three, and the state tells them apart. `start` resolves either way, because a failure arrives as state rather than as a rejection.

## 3. Keep the result and the error where you can render them

The process returns nothing, so whatever it produces stays in scope beside it. Hold the error there too, and rethrow so the operation records the failure:

```ts
let orders: Order[] = []
let failure: Error | null = null

const loadOrders = async () => {
  try {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error(`orders request failed: ${response.status}`)
    orders = await response.json()
    failure = null
  } catch (cause) {
    failure = <Error>cause
    throw cause
  }
}
```

Assigning `orders` only on success is what makes a refresh non-destructive: while the next attempt runs, the previous rows are still there to show.

## 4. Render from the state you are handed

[`on`](/docs/libraries/state-machine/async-operation#api-AsyncOperation) passes your handler the [`DerivedState`](/docs/libraries/state-machine/models#api-DerivedState) as of that transition. Test the specific states before the general ones, because [`retrying`](/docs/libraries/state-machine/models#api-DerivedState-prop-retrying) and [`restarting`](/docs/libraries/state-machine/models#api-DerivedState-prop-restarting) are both also [`inProgress`](/docs/libraries/state-machine/models#api-DerivedState-prop-inProgress):

```ts
import type { DerivedState } from '@hyperfrontend/state-machine'

const render = (state: DerivedState) => {
  if (state.notStarted) return emptyScreen()
  if (state.retrying) return errorBanner(failure, { spinner: true })
  if (state.restarting) return table(orders, { refreshing: true })
  if (state.inProgress) return skeleton()
  if (state.failed) return errorBanner(failure)
  return table(orders)
}

for (const event of ['inProgress', 'successful', 'failed'] as const) {
  operation.on(event, (_event, current) => paint(render(current)))
}
```

Those three events cover every screen, because the second start after a success arrives as `inProgress` with `restarting` already true, and the second start after a failure arrives as `inProgress` with `retrying` already true. Subscribe to [`restarting`](/docs/libraries/state-machine/models#api-Event) or `retrying` directly when something other than the view needs to know, for example an analytics call that should fire on retries only.

`operation` is a plain value with nothing to mount, so it holds the same way in a React effect, a Svelte store, a worker, or a module; over work `AsyncOperation` does not own, [`Store`](/docs/libraries/state-machine/store#api-Store) takes the same dispatches directly.

## Check it worked

Load the screen once and watch the skeleton give way to rows. Refresh, and the rows stay up with a refreshing marker instead of collapsing. Make the request fail, and the banner names it. Click retry, and the banner stays up with a spinner on it rather than blinking away. That last one is the difference the two booleans could not express.
