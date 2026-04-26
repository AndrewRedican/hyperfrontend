# object

Locked, prototype-pollution-resistant copies of the global `Object` static methods.

References to `Object.freeze`, `Object.create`, `Object.keys`, `Object.values`, `Object.entries`, `Object.assign`, `Object.defineProperty`, and the rest of the `Object` static surface are captured at module-load time and frozen into a tamper-proof namespace, so downstream code keeps working even if the global `Object` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
