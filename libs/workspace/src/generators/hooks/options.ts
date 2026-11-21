/** What the `hooks` generator takes. */
export interface HooksGeneratorOptions {
  /** Replace a hook file that neither this generator nor Lefthook wrote */
  force?: boolean
  /** Skip formatting the configuration written */
  skipFormat?: boolean
}
