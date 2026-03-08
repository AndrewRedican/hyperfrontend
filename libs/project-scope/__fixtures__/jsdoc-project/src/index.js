/**
 * @typedef {Object} User
 * @property {string} name - The user's name
 * @property {number} age - The user's age
 */

/**
 * @type {User}
 */
const user = { name: 'John', age: 30 }

/**
 * Add two numbers.
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b
}

module.exports = { user, add }
