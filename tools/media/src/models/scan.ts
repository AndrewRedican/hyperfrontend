/** How a finding is coloured. */
export type ScanTone = 'accent' | 'success' | 'warning' | 'muted'

/** One file the sweep passes over. */
export interface ScanFile {
  /** The path as shown, indentation included. */
  path: string
  /** When the sweep reaches it. */
  atMs: number
}

/** One fact the scan established, and the file it was read from. */
export interface ScanFinding {
  /** What was found, such as a framework and its version. */
  label: string
  /** Where and how it was found, in a few words. */
  evidence: string
  /** How sure the scan is, from 0 to 100. */
  confidence: number
  /** Index into the files of the one the finding was read from. */
  file: number
  /** When the finding appears. */
  atMs: number
  /** How the finding is coloured. */
  tone?: ScanTone
}

/** Everything a scene tells the scan stage. */
export interface ScanConfig {
  /** One line over the frame, naming what it is about. */
  heading?: string
  /** One line under it, arriving once the last finding has. */
  caption?: string
  /** The directory being read, shown over the tree. */
  root: string
  /** The files, in the order the sweep reaches them. */
  files: readonly ScanFile[]
  /** What the scan establishes, in any order; the stage sorts by time. */
  findings: readonly ScanFinding[]
  /** How long the frame holds after the last finding lands. */
  restMs?: number
}
