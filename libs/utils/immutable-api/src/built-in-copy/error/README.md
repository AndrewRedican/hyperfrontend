# error

Locked, prototype-pollution-resistant copies of the global `Error` constructor and its subclasses.

`Error`, `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `URIError`, `EvalError`, and `AggregateError` constructors are wrapped in `create*Error` factories at module-load time and frozen into a tamper-proof namespace, so error construction keeps producing genuine instances even if the global error constructors are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
