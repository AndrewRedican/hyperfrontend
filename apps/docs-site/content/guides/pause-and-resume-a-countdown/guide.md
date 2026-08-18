# How to pause and resume a countdown

You will build an idle timeout that stops counting while the visitor is busy, picks up exactly where it left off, and drives a display that agrees with it.

[`setTimeout`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) is a one-shot promise about the future. The moment you need to hold it while a modal is open, resume it when the modal closes, or show how long is left, you end up storing a start time, a remaining time, and a handle, and getting the arithmetic subtly wrong. [`createTimer`](/docs/libraries/utils/time#api-createTimer) from [`@hyperfrontend/time-utils`](/docs/libraries/utils/time) keeps that bookkeeping.

## 1. Install it

```bash
npm install @hyperfrontend/time-utils
```

## 2. Create the timer

```ts
import { createTimer } from '@hyperfrontend/time-utils'

const IDLE_LIMIT = 30_000

const timer = createTimer(() => signOut(), IDLE_LIMIT)
```

A new [`Timer`](/docs/libraries/utils/time#api-Timer) is holding, not running. Nothing is scheduled until you ask for it, so you can build one during setup and start it when the session actually begins.

## 3. Start and hold it from your own events

[`resume`](/docs/libraries/utils/time#api-Timer-prop-resume) schedules whatever time is left. [`pause`](/docs/libraries/utils/time#api-Timer-prop-pause) cancels the pending callback and banks the remainder. Calling either one twice is safe, so you can wire them straight to events that fire more than once:

```ts
let remaining = IDLE_LIMIT
let deadline: number | null = null

function startCountdown() {
  if (deadline !== null) return
  deadline = Date.now() + remaining
  timer.resume()
}

function holdCountdown() {
  if (deadline === null) return
  remaining = deadline - Date.now()
  deadline = null
  timer.pause()
}
```

The timer tracks the remainder for its own callback. The `deadline` and `remaining` pair above is yours, and it exists so the next step has something to render.

## 4. Restart it on a real action

A click or a keystroke should put the whole allowance back, rather than unfreezing whatever was left of it. [`reset`](/docs/libraries/utils/time#api-Timer-prop-reset) does that and leaves the timer running, whatever state it was in when you called it:

```ts
function restartCountdown() {
  remaining = IDLE_LIMIT
  deadline = Date.now() + IDLE_LIMIT
  timer.reset()
}
```

Pass a different length to `reset` when the allowance itself changes, for example a shorter window after a privileged action.

## 5. Show the time left

Read the pair you already keep, on a tick from [`createClock`](/docs/libraries/utils/time#api-createClock). While the countdown is held, `deadline` is null and the reading freezes on its own:

```ts
import { createClock } from '@hyperfrontend/time-utils'

const clock = createClock(1000)

const render = () => {
  const left = deadline === null ? remaining : deadline - Date.now()
  label.textContent = `${Math.ceil(Math.max(0, left) / 1000)}s`
}

clock.subscribe(render)
clock.start()
```

One clock can drive every countdown on the page: [`subscribe`](/docs/libraries/utils/time#api-Clock-prop-subscribe) as many callbacks as you need. When the view goes away, [`unsubscribe`](/docs/libraries/utils/time#api-Clock-prop-unsubscribe) yours and [`stop`](/docs/libraries/utils/time#api-Clock-prop-stop) the clock if it was the last one.

## Check it worked

Start the countdown and watch the label fall. Hold it and the label stops on the second it stopped at, however long you leave it. Resume, and it continues from that same second rather than jumping. Let it run out and the callback fires having counted only the time you were not holding it. Trigger a restart part way through and the label jumps back to the full allowance.
