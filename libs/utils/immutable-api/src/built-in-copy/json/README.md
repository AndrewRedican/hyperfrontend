# json

Locked, prototype-pollution-resistant copies of the global `JSON` methods.

References to `JSON.parse` and `JSON.stringify` are captured at module-load time and frozen into a tamper-proof namespace, so serialization stays trustworthy even if the global `JSON` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
