/**
 * The environment contract of a service, free of Node.js built-ins: declared variables, typed readers, and one check that reports every missing or malformed variable without echoing a value.
 *
 * @module @hyperfrontend/server/environment
 */
export type {
  EnvironmentContract,
  EnvironmentIssue,
  EnvironmentRecord,
  EnvironmentShape,
  EnvironmentValues,
  Variable,
  VariableDescription,
} from './contract'
export type { PortOptions, Reader, SchemeOptions, Secret, SecretOptions } from './readers'
export { defineEnvironment, optional, required } from './contract'
export { asDuration, asOrigin, asPort, asSecret, asText, asUrl } from './readers'
