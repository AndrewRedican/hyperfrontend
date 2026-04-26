# config

Configuration-file detection and parsing for the common config formats encountered in JavaScript/TypeScript projects.

`detectConfigs` scans a project for the configuration files registered in `CONFIG_PATTERNS` (TypeScript, ESLint, Prettier, Vite, Webpack, Babel, Jest, Vitest, Tailwind, PostCSS, etc.) and returns a `DetectedConfig[]` with the file path, type, and detection metadata. `findConfigFile(type)` is the targeted lookup for a single config. `parseConfig` (plus the `parseJsonConfig` / `parseYamlConfig` specializations) reads and parses the located file into a typed `ParsedConfig`. The `CONFIG_PATTERNS` registry is exposed so consumers can extend or filter what counts as a config without forking the heuristic.
