var {AssertFailure} = require('./assert');
var tester = require('./tester');

var {testUndoStack} = require('./tests/testUndoStack');

suites = [
  tester.makeTestSuite("testUndoStack", testUndoStack)
]

function main() {
  tester.runTestSuites(suites);
}

module.exports = {
  main
}