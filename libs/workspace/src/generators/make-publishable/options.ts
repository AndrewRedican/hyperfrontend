/** A bundle format the build writes. */
export type BundleFormat = 'esm' | 'cjs' | 'iife' | 'umd'

/** What the `make-publishable` generator takes. */
export interface MakePublishableGeneratorOptions {
  /** The project made publishable */
  project: string
  /** The bundle formats the package builds; `esm` and `cjs` when unset */
  formats?: string[]
  /** The global an `iife` or `umd` bundle registers under; derived from the package name when unset */
  globalName?: string
  /** The entry the `iife` and `umd` bundles are built from; `.` when unset */
  bundleEntry?: string
  /** npm keywords; the package's own, else its name, its scope and `typescript`, when unset */
  keywords?: string[]
  /** The Node.js range the package declares; its own, else `>=18.0.0`, when unset */
  nodeEngine?: string
  /** The executor of the `build` target; `@hyperfrontend/workspace:build` when unset */
  buildExecutor?: string
  /** The directory the e2e project is created under; `e2e` when unset */
  e2eDirectory?: string
  /** Skip creating the e2e project */
  skipE2E?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
