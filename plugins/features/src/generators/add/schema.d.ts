export interface AddGeneratorSchema {
  featureName: string
  project: string
  installMethod?: 'npm' | 'cdn'
  mountPoint?: string
}
