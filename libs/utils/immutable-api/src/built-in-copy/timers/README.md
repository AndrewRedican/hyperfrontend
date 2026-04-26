# timers

Locked, prototype-pollution-resistant copies of the global timer and scheduling functions.

`setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `queueMicrotask`, and (where available) `requestAnimationFrame` / `cancelAnimationFrame` are captured at module-load time and frozen into a tamper-proof namespace, so scheduled work keeps firing on real host timers even if the globals are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
