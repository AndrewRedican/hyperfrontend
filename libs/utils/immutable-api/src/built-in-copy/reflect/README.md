# reflect

Locked, prototype-pollution-resistant copies of the global `Reflect` methods.

References to `Reflect.apply`, `Reflect.construct`, `Reflect.get`, `Reflect.set`, `Reflect.has`, `Reflect.ownKeys`, and the rest of the `Reflect` API are captured at module-load time and frozen into a tamper-proof namespace, so meta-programming stays trustworthy even if the global `Reflect` is later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
