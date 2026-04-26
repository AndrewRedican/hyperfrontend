# logger

Scoped logger built on `@hyperfrontend/logging` with namespace prefixes, automatic secret sanitization, and a global log level registry.

`createScopedLogger(namespace, options?)` returns a frozen logger whose output is prefixed with `[namespace]` and whose metadata objects are recursively scrubbed for sensitive keys (matching patterns like `token`, `key`, `password`, `secret`, `credential`, `auth`, `bearer`, `api_key`, `private`, `passphrase`). All loggers register themselves so `setGlobalLogLevel` can flip verbosity across the entire library at once. A default `logger` instance scoped to `project-scope` is exported for general use.
