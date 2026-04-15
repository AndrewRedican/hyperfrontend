/**
 * Frontend framework detection for React, Next.js, Vue, Angular, Svelte, Solid, Qwik, and more.
 *
 * @module @hyperfrontend/project-scope/tech/frontend
 */
export type { FrameworkDetection, FrameworkDetector } from './types'
export { angularDetector } from './angular'
export { astroDetector } from './astro'
export { detectFrontendFrameworks, frameworkDetectors } from './detect-all'
export { gatsbyDetector } from './gatsby'
export { nextjsDetector } from './nextjs'
export { nuxtDetector } from './nuxt'
export { qwikDetector } from './qwik'
export { reactDetector } from './react'
export { remixDetector } from './remix'
export { solidDetector } from './solid'
export { svelteDetector } from './svelte'
export { sveltekitDetector } from './sveltekit'
export { vueDetector } from './vue'
