/**
 * Frontend framework detection for React, Next.js, Vue, Angular, Svelte, Solid, Qwik, and more.
 *
 * @module @hyperfrontend/project-scope/tech/frontend
 */
export type { FrameworkDetection, FrameworkDetector } from './types'
export { reactDetector } from './react'
export { nextjsDetector } from './nextjs'
export { remixDetector } from './remix'
export { gatsbyDetector } from './gatsby'
export { vueDetector } from './vue'
export { nuxtDetector } from './nuxt'
export { angularDetector } from './angular'
export { svelteDetector } from './svelte'
export { sveltekitDetector } from './sveltekit'
export { solidDetector } from './solid'
export { qwikDetector } from './qwik'
export { astroDetector } from './astro'
export { detectFrontendFrameworks, frameworkDetectors } from './detect-all'
