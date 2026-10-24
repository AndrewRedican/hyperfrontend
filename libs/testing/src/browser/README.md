# browser

Stand-ins for the browser surfaces a test environment cannot supply: windows that message each other across origins, and a `ResizeObserver` the test drives.

## Usage

Unlike [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/), importing this entry changes nothing on the global, and none of it needs jsdom. Each stand-in is typed as the browser interface it replaces, so it goes straight into code that expects a `Window` without a cast.

### Windows that message each other

[`createWindowPair`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-createWindowPair) returns two windows wired the way a page and the frame or popup it opened are. Posting to one delivers to that window's listeners with the other window as the event's source and the other window's origin as its origin:

```typescript
import { expect, it, waitUntil } from '@hyperfrontend/testing'
import { createWindowPair } from '@hyperfrontend/testing/browser'
import { connect } from './connect'

it('connects a host and its frame', async () => {
  const [host, frame] = createWindowPair({ origins: ['https://host.test', 'https://frame.test'] })
  const hostSide = connect({ listenOn: host, peer: frame })
  const frameSide = connect({ listenOn: frame, peer: host })

  await waitUntil(() => hostSide.isOpen() && frameSide.isOpen())

  expect(frame.posted()).toEqual([expect.objectContaining({ type: 'HELLO' })])
})
```

| Behaviour     | What the pair does                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery      | On a later timer task, as a browser delivers, which fake timers control. Pass `delivery: 'sync'` to deliver inside the call instead.                                                         |
| Target origin | A post whose target origin is neither `*` nor the receiving window's origin is dropped. `/` stands for the sender's own origin.                                                              |
| Copying       | The message is copied with `structuredClone`. A transfer list is ignored, so a posted buffer stays readable in the recorded call.                                                            |
| Recording     | Every post is recorded, delivered or not: `postMessage` is a mock function, and [`posted`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-FakeWindow) lists the messages. |

[`createFakeWindow`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-createFakeWindow) is a single window with no counterpart: it records what is posted to it, and [`receive`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-FakeWindow) dispatches a message to its listeners as if another origin had sent it.

### ResizeObserver

[`installResizeObserver`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-installResizeObserver) puts a `ResizeObserver` on the global and returns the controller that sends its notifications:

```typescript
const observers = installResizeObserver()
const panel = mountPanel(container)

observers.resize(container, { width: 320, height: 200 })

expect(panel.layout()).toBe('compact')
```

Observers behave like real ones, observing, unobserving and disconnecting, and each entry carries the content rectangle and every box size. A callback runs only when the test calls [`resize`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-ResizeObserverController), never on its own, not even for the initial notification a browser sends when observation starts. [`resizeLate`](https://www.hyperfrontend.dev/docs/libraries/testing/browser/#api-ResizeObserverController) also reaches observers that have stopped watching the element, the way a notification already queued when observation stopped still arrives, for testing code that must ignore one. The stub is installed as a stubbed global, so [`jest.restoreAllMocks`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) removes it.
