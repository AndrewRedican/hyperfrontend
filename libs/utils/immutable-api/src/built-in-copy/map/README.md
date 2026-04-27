# map

Locked, prototype-pollution-resistant copy of the global `Map` constructor.

The `Map` constructor is wrapped in a `createMap` factory and `Map.groupBy` (where available) is captured at module-load time and frozen into a tamper-proof namespace, so keyed-collection construction keeps working even if the global `Map` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
