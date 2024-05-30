var {AssertFailure} = require('./assert');
var tester = require('./tester');

var {testUndoStack} = require('./tests/testUndoStack');
var {testWeavedUndoStack} = require('./tests/testWeavedUndoStack');
var {testNodeUndoStack} = require('./tests/testNodeUndoStack');

suites = [
  tester.makeTestSuite("testUndoStack", testUndoStack),
  tester.makeTestSuite("testWeavedUndoStack", testWeavedUndoStack),
  tester.makeTestSuite("testNodeUndoStack", testNodeUndoStack)
]

function main() {
  tester.runTestSuites(suites);
}

module.exports = {
  main
}