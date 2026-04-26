# math

Locked, prototype-pollution-resistant copies of the global `Math` static methods and constants.

References to `Math.E`, `Math.PI`, `Math.LN2`, `Math.LN10`, `Math.LOG2E`, `Math.LOG10E`, `Math.SQRT2`, `Math.SQRT1_2`, plus the full set of math functions (`abs`, `floor`, `ceil`, `round`, `sqrt`, `pow`, trig, logarithms, etc.) are captured at module-load time and frozen into a tamper-proof namespace, so numeric computations stay deterministic even if the global `Math` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
