export interface TimeBasedPasswordGenerators {
  readonly current: () => Promise<string>
  readonly previous: () => Promise<string>
  readonly next: () => Promise<string>
}
