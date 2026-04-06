/**
 * Generators for time-based one-time passwords (TOTP).
 */
export interface TimeBasedPasswordGenerators {
  /** Generates the password for the current time window. */
  readonly current: () => Promise<string>
  /** Generates the password for the previous time window. */
  readonly previous: () => Promise<string>
  /** Generates the password for the next time window. */
  readonly next: () => Promise<string>
}
