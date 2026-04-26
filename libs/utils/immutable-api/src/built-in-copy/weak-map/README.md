# weak-map

Locked, prototype-pollution-resistant copy of the global `WeakMap` constructor.

The `WeakMap` constructor is wrapped in a `createWeakMap` factory at module-load time and frozen into a tamper-proof namespace, so private-state storage keeps working even if the global `WeakMap` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
