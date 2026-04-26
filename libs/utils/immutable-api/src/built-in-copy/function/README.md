# function

Locked, prototype-pollution-resistant copy of the global `Function` constructor and its prototype helpers.

The `Function` constructor is wrapped in a `createFunction` factory and `Function.prototype.call`, `apply`, and `bind` are captured at module-load time and frozen into a tamper-proof namespace, so reflective invocation keeps working even if the global `Function` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
