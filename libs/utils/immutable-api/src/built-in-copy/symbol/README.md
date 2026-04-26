# symbol

Locked, prototype-pollution-resistant copy of the global `Symbol` factory and well-known symbols.

The `Symbol` constructor is wrapped in a `createSymbol` factory and the well-known symbols (`iterator`, `asyncIterator`, `toStringTag`, `hasInstance`, `match`, `replace`, etc.) plus `Symbol.for` and `Symbol.keyFor` are captured at module-load time and frozen into a tamper-proof namespace, so symbol-keyed protocols stay trustworthy even if the global `Symbol` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
