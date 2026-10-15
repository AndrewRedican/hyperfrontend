# dom

The preload that gives a suite a browser-shaped global: a jsdom window copied onto `globalThis` before the suite's own setup modules run.

## Overview

Node has no environment concept, so a DOM is a preload. Hand the entry to Node after the hooks preload, and it installs the window the moment it is imported:

```bash
node --import @hyperfrontend/testing/hooks \
  --import @hyperfrontend/testing/dom \
  --test 'src/**/*.browser.spec.ts'
```

Through the runner, an environment declaring [`dom`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestEnvironment) gets the same preload placed before its own [`setupFiles`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestEnvironment), so a setup module may assume `document` exists. The entry imports jsdom, which is an optional peer dependency of the package: a project that never preloads it never needs it installed, and a project that does installs it alongside.

[`installDom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/#api-installDom) creates one window for an empty document at `http://localhost/` with [`pretendToBeVisual`](https://github.com/jsdom/jsdom#pretending-to-be-a-visual-browser) on, which is what supplies `requestAnimationFrame` and makes the document report itself as visible. The window's own properties are then copied onto the process global by value, as non-enumerable writable properties, and `addEventListener`, `removeEventListener` and `dispatchEvent` are bound to the window and copied as well, since a window inherits them rather than owning them. Finally `window` and its aliases self, globalThis, parent and top are all pointed at the process global.

### What stays Node's

Only what jsdom owns is copied. Everything in the table keeps Node's implementation even though jsdom defines its own.

| Kept from Node                                                                                | Why                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ECMAScript intrinsics (`Array`, `Object`, `Promise`, `Error` and the rest)                | A jsdom window has a realm of its own. Copying its intrinsics across would make every `instanceof` in the process disagree with itself. The set is derived from a bare `node:vm` context rather than listed, so a future language addition is excluded without anyone noticing. |
| `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `queueMicrotask`, `performance` | These are what the fake clock behind [`jest.useFakeTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) replaces. A jsdom copy would leave the clock driving nothing.                                                                                    |
| `crypto`                                                                                      | Node's WebCrypto implements `subtle`; jsdom's supplies only getRandomValues. Keeping Node's is what gives a browser suite a working `crypto.subtle` with no further override.                                                                                                   |
| `URL`, `URLSearchParams`                                                                      | `node:url` recognises its own class and not the one jsdom exports.                                                                                                                                                                                                              |
| `atob`, `btoa`                                                                                | jsdom's implementations delegate to the global of the same name. A copy on the global would resolve to itself and recurse until the stack is exhausted.                                                                                                                         |

## Design

The globals are copies rather than the window itself. A browser makes `window` the global object by running code inside it; the Jest environment this replaces did the same. Here the values are copied onto the process global and `window` is pointed back at that global, so there is one slot per name: a spy installed on [`window.getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) is the function that code calling the bare name reaches, and a listener registered through the global and an event dispatched at it meet on the same target.

Values are read rather than descriptors moved. `document`, `navigator` and `location` are accessors whose getters check that they were called on a window, so a descriptor copied verbatim onto `globalThis` would throw the moment it was read. The handful of window properties that throw when read outside a browsing context are skipped: a global that cannot be produced is one no suite can have been using.
