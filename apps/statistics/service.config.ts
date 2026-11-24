/**
 * The configuration the service-statistics service is built with: the immutable section holds the structural settings that are fixed when the service is built.
 *
 * `packages` is every package whose download history the service collects, by full npm name. A package is listed from the commit that adds its library, ahead of its first release: until npm knows it, the service reports it as pending and asks again on its next collection.
 */
export default {
  immutable: {
    packages: [
      '@hyperfrontend/builder',
      '@hyperfrontend/cryptography',
      '@hyperfrontend/data-utils',
      '@hyperfrontend/features',
      '@hyperfrontend/function-utils',
      '@hyperfrontend/immutable-api-utils',
      '@hyperfrontend/json-utils',
      '@hyperfrontend/linter',
      '@hyperfrontend/list-utils',
      '@hyperfrontend/logging',
      '@hyperfrontend/network-protocol',
      '@hyperfrontend/nexus',
      '@hyperfrontend/project-scope',
      '@hyperfrontend/questions',
      '@hyperfrontend/random-generator-utils',
      '@hyperfrontend/server',
      '@hyperfrontend/state-machine',
      '@hyperfrontend/string-utils',
      '@hyperfrontend/testing',
      '@hyperfrontend/time-utils',
      '@hyperfrontend/ui-utils',
      '@hyperfrontend/versioning',
      '@hyperfrontend/workspace',
    ],
  },
}
