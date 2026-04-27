# console

Locked, prototype-pollution-resistant copies of the global `console` methods, pre-bound to the original console object.

`log`, `warn`, `error`, `info`, `debug`, `trace`, `dir`, `table`, `assert`, `group*`, `time*`, and the rest of the `console` surface are captured (and `.bind()`-ed) at module-load time and frozen into a tamper-proof namespace, so diagnostic output keeps reaching the real console even if `globalThis.console` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
