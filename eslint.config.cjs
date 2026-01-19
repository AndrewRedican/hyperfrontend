/* eslint-disable @typescript-eslint/no-require-imports */
const baseConfig = require('./eslint.base.config.cjs');
module.exports = [
  ...baseConfig,
  {
    ignores: [
      'docs/',
      '.nx/',
      'dist/',
      'coverage/',
      'tmp/',
      '**/*.spec.{ts,tsx,js,jsx}'
    ]
  }
];