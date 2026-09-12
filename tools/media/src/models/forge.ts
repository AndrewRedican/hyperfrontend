import type { Mark } from './banner'

/** The formats a file in the output tree can be, as its pill names it. */
export type ForgeFormat = 'esm' | 'cjs' | 'dts' | 'iife' | 'umd'

/** One file an entry lands in the output tree. */
export interface ForgeOutput {
  /** Path relative to the output directory. */
  name: string
  /** The format its pill names. */
  format: ForgeFormat
  /** Manifest keys this file is wired to, beside the key that spans every file. */
  keys: readonly string[]
}

/** One source entry the builder takes in on its own. */
export interface ForgeEntry {
  /** Path relative to the source directory. */
  name: string
  /** The files this entry lands, in the order they appear. */
  outputs: readonly ForgeOutput[]
}

/** The manifest the build writes, as the sheet at the bottom draws it. */
export interface ForgeManifest {
  /** The file's name, set quietly on the sheet. */
  name: string
  /** The keys, in the order they sit on the sheet. */
  keys: readonly string[]
  /** The key wired to every file at once, by a bracket down the side of the tree. */
  spanKey: string
}

/** The package API the forge stands for. */
export interface ForgeApi {
  /** The function name, as a reader would import it. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/** Everything a scene tells the forge stage. */
export interface ForgeConfig {
  /** The call whose behaviour the forge shows. */
  api: ForgeApi
  /** Name of the directory the entries come from, set over the source cards. */
  sourceDir: string
  /** Name of the directory the files land in, set over the output tree. */
  outputDir: string
  /** The entries, in the order they go in. */
  entries: readonly ForgeEntry[]
  /** The manifest. */
  manifest: ForgeManifest
  /** How long the frame holds after the last key lights. */
  restMs?: number
}
