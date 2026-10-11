# websocket

Locked, prototype-pollution-resistant copy of the global `WebSocket` constructor.

A factory wrapping `WebSocket` is captured at module-load time and frozen into a tamper-proof namespace, so socket construction stays trustworthy even if the global is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.

On a runtime without a `WebSocket` global (Node.js before 22) the module still imports: the ready-state constants hold the values the WebSocket standard fixes, and [`createWebSocket`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/websocket/#api-createWebSocket) throws a `TypeError`.
