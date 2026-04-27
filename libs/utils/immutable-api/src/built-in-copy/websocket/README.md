# websocket

Locked, prototype-pollution-resistant copy of the global `WebSocket` constructor.

A factory wrapping `WebSocket` is captured at module-load time and frozen into a tamper-proof namespace, so socket construction stays trustworthy even if the global is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
