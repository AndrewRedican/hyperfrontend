import util from 'node:util'

// compat: node<18.3 util.parseArgs arrived in Node 18.3; reading it off the module object keeps every entry linking on older releases, where the call fails instead of the import, so the named import can return once the floor passes
export const parseArgs = util.parseArgs
