# How to make a service safe to use before it is ready

You will let every caller of a shared service subscribe to it whenever they happen to load, before or after its async setup finished, and have all of them run as soon as it is usable.

A service with an async start has two callers and only one of them is ever handled. The one that loads early subscribes and waits; the one that loads late subscribes to an event that already fired and waits forever. The usual patch is an `isReady` boolean checked before subscribing, which is the race written out longhand: the value can change between the check and the subscribe. [`LifecycleAwareComponent`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent) from [`@hyperfrontend/state-machine`](/docs/libraries/state-machine) closes that window by making subscription itself the check.

## 1. Install it

```bash
npm install @hyperfrontend/state-machine
```

## 2. Do the setup once, however many callers ask

The base class declares three lifecycle steps for you to fill in: [`init`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-prop-init) for one-time setup, [`start`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-prop-start) for going live, and [`stop`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-prop-stop) for standing down. Each returns `'success'`, `'fail'`, or `'skipped'`.

Checking a flag is not enough to make `init` run once, because callers that arrive during the setup all pass the check before it flips. Hold the in-flight promise instead and hand it to everyone who asks while it is unresolved:

```ts
import { LifecycleAwareComponent } from '@hyperfrontend/state-machine/lifecycle-aware-component'

type Status = 'success' | 'fail' | 'skipped'

class Analytics extends LifecycleAwareComponent {
  private session: Session | null = null
  private opening: Promise<Status> | null = null

  protected init = async (): Promise<Status> => {
    if (this.ready) return 'skipped'
    this.opening ??= this.open()
    return this.opening
  }

  private open = async (): Promise<Status> => {
    this.setInitializing(true)
    try {
      this.session = await openSession()
      this.setReady(true)
      return 'success'
    } catch {
      return 'fail'
    } finally {
      this.setInitializing(false)
      this.opening = null
    }
  }
```

The class stays open here: `start` and `stop` are abstract on the base, so it does not compile until the next two steps add them. The `ready` check still earns its place: it turns a call that arrives after setup finished into a cheap `'skipped'` without touching the promise. `init` is protected, so it is yours to drive rather than the application's.

[`setInitializing`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-method-setInitializing) and [`setReady`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-method-setReady) are two of the five setters that are the only way the flags move, and each is edge-guarded: setting a flag to the value it already holds notifies nobody. Call them wherever the truth changes, without deduplicating first.

## 3. Give every caller the same entry point

A public `start` drives `init` and then goes live, so nothing outside the class has to know whether setup has happened yet:

```ts
start = async (): Promise<Status> => {
  const outcome = await this.init()
  if (outcome === 'fail') return outcome
  this.setActive(true)
  return 'success'
}
```

Because `init` is now idempotent, `start` is too: call it from three modules on the same tick and one session opens, all three resolve, and [`setActive`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-method-setActive) announces the transition once.

## 4. Stand down through the same flags

```ts
stop = async (): Promise<Status> => {
  this.setActive(false)
  this.session = null
  this.setReady(false)
  return 'success'
}
```

Flipping the flags back down is what lets the same subscribers hear about a shutdown, so a screen that lit up on `active` dims again without a second mechanism. Clearing `ready` also re-arms `init`, so a later `start` opens a fresh session rather than reusing a closed one.

## 5. Subscribe from anywhere, at any time

[`onActiveStatusChange`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-method-onActiveStatusChange) and its siblings register a handler and, when the flag is already up, deliver the current value immediately. A module that loads long after startup gets told on the spot; one that loads first is told when the transition happens. Neither caller checks anything, and there is no ordering to get right:

```ts
export const analytics = new Analytics()
void analytics.start()
```

```ts
// in a module loaded at some unpredictable later moment
import { analytics } from './analytics'

analytics.onActiveStatusChange((active) => {
  if (active) flushQueuedEvents()
})
```

Write the handler so that running it again with the same value is harmless, because a later subscriber arriving while the flag is up replays the current value to everyone already listening. Handlers that describe a state ("show the panel", "flush what is queued") satisfy that for free; one that increments a counter does not.

## 6. Read a flag when you only need the answer now

Subscription is for reacting to the change. Where all you need is the answer at this moment, the flags are also plain getters, so a guard inside a method is a normal read:

```ts
  track(event: string): void {
    if (!this.active || this.session === null) return
    send(this.session, event)
  }
```

[`clear`](/docs/libraries/state-machine/lifecycle-aware-component#api-LifecycleAwareComponent-method-clear) drops every registered handler at once, which is what a teardown in a test or a hot-reloading dev server wants before it builds the next instance.

## Check it worked

Call `start` from three places on the same tick and count the sessions your setup opened: one, and all three calls resolve `'success'`. Subscribe before that and confirm the handler runs when setup completes; then subscribe from a module you import a full second later, and confirm that one runs immediately with `true`. Call `start` again after it has settled: `init` returns `'skipped'` and no subscriber hears a duplicate transition. Finally call `stop`, watch the same handlers receive `false`, and confirm the next `start` opens a new session rather than resurrecting the old one.
