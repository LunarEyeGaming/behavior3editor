var {AssertFailure} = require('./assert');
var tester = require('./tester');

var {testUndoStack} = require('./tests/testUndoStack');
var {testWeavedUndoStack} = require('./tests/testWeavedUndoStack');
var {testNodeUndoStack} = require('./tests/testNodeUndoStack');
var {testJsonEquals} = require('./tests/testJsonEquals');

suites = [
  tester.makeTestSuite("testUndoStack", testUndoStack),
  tester.makeTestSuite("testWeavedUndoStack", testWeavedUndoStack),
  tester.makeTestSuite("testNodeUndoStack", testNodeUndoStack),
  tester.makeTestSuite("testJsonEquals", testJsonEquals)
]

function main() {
  tester.runTestSuites(suites);
}

module.exports = {
  main
}