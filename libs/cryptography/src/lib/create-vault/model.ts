export interface Vault {
  write(label: string, value: string): Promise<void>
  read(label: string, password: string): Promise<string | null>
  getPassword(): string
  close(): void
}
