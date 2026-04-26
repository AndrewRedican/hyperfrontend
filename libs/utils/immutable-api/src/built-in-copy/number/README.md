# number

Locked, prototype-pollution-resistant copies of the global `Number` static methods, constants, and the global numeric parsers.

References to `Number.MAX_VALUE`, `Number.MIN_VALUE`, `Number.MAX_SAFE_INTEGER`, `Number.MIN_SAFE_INTEGER`, `Number.EPSILON`, `Number.NaN`, `Number.POSITIVE_INFINITY`, `Number.NEGATIVE_INFINITY`, `Number.isFinite`, `Number.isInteger`, `Number.isNaN`, `Number.isSafeInteger`, plus the global `parseInt`, `parseFloat`, `isNaN`, and `isFinite`, are captured at module-load time and frozen into a tamper-proof namespace. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
