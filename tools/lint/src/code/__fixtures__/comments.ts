// leading line comment
/* leading block */
/** jsdoc */
const a = /* inline */ 1 // trailing
/**
 * multi
 * line
 */
function b() {} /* after */ // and after
const c = `template with // not a comment /* nor this */`
const d = '// string' + "/* string */"
const e = /\/\/ regex \/\* /g
/* final */
