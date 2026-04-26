# messaging

Locked, prototype-pollution-resistant copies of the global cross-context messaging APIs.

`structuredClone`, `MessageChannel`, and `BroadcastChannel` constructors are wrapped in factories, and safe `postMessage*` helpers for `Window`, `Worker`, `MessagePort`, and `BroadcastChannel` targets are captured at module-load time and frozen into a tamper-proof namespace, so cross-context communication stays trustworthy even if the globals are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
