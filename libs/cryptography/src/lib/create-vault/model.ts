export interface Vault {
  readonly write: (label: string, value: string) => Promise<void>
  readonly read: (label: string, password: string) => Promise<string | null>
  readonly getPassword: () => string | null
  readonly close: () => void
}
