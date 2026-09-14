# set

Locked, prototype-pollution-resistant copy of the global `Set` constructor.

The `Set` constructor is wrapped in a [`createSet`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/set/#api-createSet) factory at module-load time and frozen into a tamper-proof namespace, so unique-value collection construction keeps working even if the global `Set` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
