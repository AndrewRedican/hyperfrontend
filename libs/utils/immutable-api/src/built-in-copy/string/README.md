# string

Locked, prototype-pollution-resistant copies of the global `String` static methods.

References to `String.fromCharCode`, `String.fromCodePoint`, `String.raw`, plus a frozen namespace bundling all of them, are captured at module-load time, so string-construction helpers continue to behave correctly even if the global `String` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
