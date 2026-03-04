// ES import
import { helper } from './helper'

// Dynamic import
async function loadUtils() {
  const utils = await import('./utils')
  return utils.doSomething()
}

// CommonJS require
const config = require('./config')

// Export from
export * from './types'

console.log(helper, loadUtils, config)
