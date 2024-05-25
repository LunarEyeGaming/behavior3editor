var TestCommand = (function() {
  // This coding weirdness is to keep the scope of p local.
  var TestCommand = b3.Class(b3editor.Command);
  var p = TestCommand.prototype;

  p.initialize = function(args) {
    this.runFunc = args.runFunc;
    this.undoFunc = args.undoFunc;
  }

  p.run = function() {
    this.runFunc();
  }

  p.undo = function() {
    this.undoFunc();
  }

  return TestCommand;
}());

function makeTestCommand(runFunc, undoFunc) {
  return new TestCommand({runFunc, undoFunc});
}

module.exports = {
  makeTestCommand
}