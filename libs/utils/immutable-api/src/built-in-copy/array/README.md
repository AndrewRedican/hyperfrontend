# array

Locked, prototype-pollution-resistant copies of the global `Array` static methods.

References to `Array.isArray`, `Array.from`, and `Array.of` are captured at module-load time and frozen into a tamper-proof namespace, so downstream code keeps working even if the global `Array` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
