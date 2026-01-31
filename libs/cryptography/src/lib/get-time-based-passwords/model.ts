export interface TimeBasedPasswordGenerators {
  current: () => Promise<string>
  previous: () => Promise<string>
  next: () => Promise<string>
}
