# weak-set

Locked, prototype-pollution-resistant copy of the global `WeakSet` constructor.

The `WeakSet` constructor is wrapped in a `createWeakSet` factory at module-load time and frozen into a tamper-proof namespace, so weakly-held membership tracking keeps working even if the global `WeakSet` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
