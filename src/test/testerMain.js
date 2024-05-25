var {AssertFailure} = require('./assert');
var tester = require('./tester');

var {testUndoStack} = require('./tests/testUndoStack');
var {testWeavedUndoStack} = require('./tests/testWeavedUndoStack');

suites = [
  tester.makeTestSuite("testUndoStack", testUndoStack),
  tester.makeTestSuite("testWeavedUndoStack", testWeavedUndoStack)
]

function main() {
  tester.runTestSuites(suites);
}

module.exports = {
  main
}