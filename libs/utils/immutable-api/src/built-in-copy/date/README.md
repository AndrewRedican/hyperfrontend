# date

Locked, prototype-pollution-resistant copy of the global `Date` constructor and its statics.

The `Date` constructor is wrapped in a [`createDate`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/date/#api-createDate) factory (with all overloads preserved) and `Date.now`, `Date.parse`, and `Date.UTC` are captured at module-load time and frozen into a tamper-proof namespace, so timestamp work keeps producing trustworthy values even if the global `Date` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
