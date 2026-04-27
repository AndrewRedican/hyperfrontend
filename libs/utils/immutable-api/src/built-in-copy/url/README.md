# url

Locked, prototype-pollution-resistant copies of the global `URL` and `URLSearchParams` constructors.

Factory wrappers for `URL` and `URLSearchParams` are captured at module-load time and frozen into a tamper-proof namespace, so URL parsing and query-string handling continue to behave correctly even if the globals are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
