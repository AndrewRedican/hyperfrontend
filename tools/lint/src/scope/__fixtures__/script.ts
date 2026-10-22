var top = 1
top = 2
undeclared = 3
function outer(param = inner) {
  var inner = param
  return arguments
}
const arrowValue = () => top
yield 1
function declared(a = outer): void
for (let i = 0; i < 1; i++) {
  {
    var fromBlock = i
  }
}
