/**
 * Schema for the add generator configuration.
 */
export interface AddGeneratorSchema {
  /** Name of the feature to add */
  featureName: string
  /** Target project for the feature */
  project: string
  /** Installation method for dependencies */
  installMethod?: 'npm' | 'cdn'
  /** DOM element selector for mounting */
  mountPoint?: string
}
