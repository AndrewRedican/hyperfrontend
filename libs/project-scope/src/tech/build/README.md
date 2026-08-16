# build

Build-tool detectors for the JavaScript/TypeScript build ecosystem.

Covers Webpack, Vite, Rollup, esbuild, Babel, SWC, and Parcel. Each tool exposes its `<tool>Detector` plus a `<TOOL>_CONFIG_PATTERNS` constant describing the config-file shapes it recognizes. `detectBuildTools` runs all detectors and returns the aggregate `BuildToolDetection[]`. Detectors are unopinionated about preferred build tooling: they return what they find and at what confidence; consumers decide what to do with the results.
