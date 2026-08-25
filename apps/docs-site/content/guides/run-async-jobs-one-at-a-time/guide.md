# How to run async jobs one at a time, in order

You will build a work queue that runs one job at a time in the order they arrived, keeps accepting work while it is draining, survives a job that throws, and can tell you what is still waiting.

Anything that writes needs this eventually: an outbox that must not reorder, uploads that would otherwise saturate a connection, saves that must not overlap on the same record. The usual first attempt is an array with [`shift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) and a `busy` flag, and it works until the second entry point calls it, or until a rejected promise leaves the flag stuck at `true` and the queue never moves again. [`createFifoList`](/docs/libraries/utils/list#api-createFifoList) from [`@hyperfrontend/list-utils`](/docs/libraries/utils/list) gives you the queue with membership built in, which is what makes the rest of it small.

## 1. Install it

```bash
npm install @hyperfrontend/list-utils
```

## 2. Describe a job as an object

A [`FifoList`](/docs/libraries/utils/list#api-FifoList) holds objects and identifies them by reference, so make each job an object carrying everything needed to run it and to report on it later:

```js
const createJob = (id, run) => ({ id, run, onError: (cause) => console.error(`${id} failed`, cause) })
```

Holding the work as data rather than as a bare closure is what lets a later step find a specific job, ask whether it is queued, and take it back out.

## 3. Drain the queue one job at a time

[`push`](/docs/libraries/utils/list#api-FifoList) adds to the back, [`pull`](/docs/libraries/utils/list#api-FifoList) takes from the front, and [`size`](/docs/libraries/utils/list#api-FifoList) says whether there is anything left. [Awaiting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) inside the loop is the whole of the ordering guarantee: the next `pull` cannot happen until the current job settles.

```js
import { createFifoList } from '@hyperfrontend/list-utils'

const pending = createFifoList()
let active = null

async function drain() {
  if (active !== null) return
  try {
    while (pending.size() > 0) {
      active = pending.pull()
      try {
        await active.run()
      } catch (cause) {
        active.onError?.(cause)
      }
    }
  } finally {
    active = null
  }
}
```

The inner `try` is what keeps one bad job from stopping the queue: a rejection is reported and the loop moves on. The `finally` releases the pump on every exit path, so `active` can never be left pointing at a job that has finished, which is the state that would wedge the queue for good.

## 4. Keep exactly one drain running

`drain` returns immediately when a job is already in flight, so every entry point can call it without coordinating. Adding work and starting the pump then collapse into one function that is safe to call from anywhere:

```js
function enqueue(job) {
  if (active === job || pending.has(job)) return
  pending.push(job)
  void drain()
}
```

Both halves of that guard are load-bearing. [`has`](/docs/libraries/utils/list#api-FifoList) compares by reference, so it catches a job still waiting its turn; comparing against `active` catches the one already running, which `pull` has by then removed from the list. Without the second check, a retry that fires while its own job is in flight enqueues a duplicate. Push the same object twice without the guard and the list throws rather than silently queueing it twice, so this is a check you want to make deliberately.

Work added while a drain is running is picked up by that same drain before it exits: the `while` condition is re-evaluated after every job.

## 5. Inspect and cancel what is still waiting

Because the queue is a real collection, the two questions a user interface asks have direct answers. [`map`](/docs/libraries/utils/list#api-FifoList) walks it front to back for a progress list, and [`remove`](/docs/libraries/utils/list#api-FifoList) takes a specific job back out, reporting whether it was still there to remove:

```js
const waiting = pending.map((queued) => queued.id)

if (!pending.remove(upload)) {
  // already running or already finished; cancel it through its own work instead
}
```

That `false` is the answer to the race a cancel button always has: by the time someone clicks, the job may have started. Deciding what to do about the in-flight case belongs to the job, which is another reason to keep the work as an object rather than a closure.

## Check it worked

Enqueue three jobs with deliberately different durations and confirm the completions come back in the order you queued them rather than by how long each took. Enqueue the same job object twice in one tick and confirm it runs once. Make the second of three jobs reject, and confirm the third still runs and the error reached that job's own handler. Add a fourth job from a timer while the queue is mid-drain, and confirm it runs without you starting a second pump. Finally, remove a queued job before it starts and confirm it never runs, then remove it again and get `false`.
