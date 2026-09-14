# frontend

Frontend-framework detectors for the modern web framework landscape.

Covers React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Solid, Qwik, Astro, Remix, and Gatsby. Each `<framework>Detector` follows the shared [`FrameworkDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/frontend/#api-FrameworkDetector) contract; [`detectFrontendFrameworks`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/frontend/#api-detectFrontendFrameworks) runs them all and returns the aggregate `FrameworkDetection[]`. The detectors look at `package.json` dependencies, framework-specific files (`next.config.js`, `vite.config.ts`, `angular.json`, etc.), and characteristic source patterns to score each framework with confidence and evidence.
