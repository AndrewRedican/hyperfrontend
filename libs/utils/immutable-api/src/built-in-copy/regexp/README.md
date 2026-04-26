# regexp

Locked, prototype-pollution-resistant copy of the global `RegExp` constructor.

The `RegExp` constructor is wrapped in a `createRegExp` factory at module-load time and frozen into a tamper-proof namespace, so pattern construction keeps working even if the global `RegExp` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
