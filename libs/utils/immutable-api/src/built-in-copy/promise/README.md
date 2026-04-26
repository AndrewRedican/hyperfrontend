# promise

Locked, prototype-pollution-resistant copy of the global `Promise` constructor and its statics.

The `Promise` constructor is wrapped in a `createPromise` factory and its statics (`resolve`, `reject`, `all`, `race`, `allSettled`, `any`, `withResolvers`) are captured at module-load time and frozen into a tamper-proof namespace, so async control flow keeps working even if the global `Promise` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
