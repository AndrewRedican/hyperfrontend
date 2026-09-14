# function

Locked, prototype-pollution-resistant copy of the global `Function` constructor and its prototype helpers.

The `Function` constructor is wrapped in a [`createFunction`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/function/#api-createFunction) factory and `Function.prototype.call`, [`apply`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/function/#api-Function), and [`bind`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/function/#api-Function) are captured at module-load time and frozen into a tamper-proof namespace, so reflective invocation keeps working even if the global `Function` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
