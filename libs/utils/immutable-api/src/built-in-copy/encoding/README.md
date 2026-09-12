# encoding

Locked, prototype-pollution-resistant copies of the global text encoding APIs.

`TextEncoder` and `TextDecoder` constructors are wrapped in factories, and [`atob`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/encoding/#api-atob) / [`btoa`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/encoding/#api-btoa) references are captured at module-load time and frozen into a tamper-proof namespace, so encoding and base64 work continues to behave correctly even if the globals are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
