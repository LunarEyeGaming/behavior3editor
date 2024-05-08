var {makeTest} = require("../tester");
var {assertThrows, assertEqual, assertStrictEqual} = require("../assert");

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

var suite = [
  makeTest("addCommand basic functionality", () => {
    var undoHistory = new b3editor.UndoStack();
    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = "bar"}, () => {}));

    // Make sure that the redo command has been executed.
    assertEqual("bar", someObject.foo);
  }),
  makeTest("addCommand throws error on null, undefined, or otherwise invalid 'cmd' argument", () => {
    var undoHistory = new b3editor.UndoStack();
    assertThrows("TypeError", () => undoHistory.addCommand(undefined));
    assertThrows("TypeError", () => undoHistory.addCommand(null));
    assertThrows("TypeError", () => undoHistory.addCommand("Not a Command"));
    assertThrows("TypeError", () => undoHistory.addCommand(function() {return "Something!"}));
  }),
  makeTest("undoLastCommand basic functionality", () => {
    var undoHistory = new b3editor.UndoStack();
    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = "bar"}, () => {someObject.foo = undefined}));
    undoHistory.undoLastCommand();

    // Make sure that someObject.foo has been deleted.
    assertStrictEqual(undefined, someObject.foo);
  }),
  makeTest("undoLastCommand until there are no more commands to undo", () => {
    var undoHistory = new b3editor.UndoStack();
    var counter = 0;

    var run = () => {
      counter++;
    };
    var undo = () => {
        counter--;
    };

    var cmd = makeTestCommand(run, undo);

    undoHistory.addCommand(cmd);
    undoHistory.addCommand(cmd);
    undoHistory.addCommand(cmd);

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // Should have no effect.
    undoHistory.undoLastCommand();

    // Make sure that the counter is unaffected.
    assertStrictEqual(0, counter);
  }),
  makeTest("undoLastCommand when no commands have been added", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.undoLastCommand();  // No exceptions should be thrown.
  }),
  makeTest("Creating multiple UndoStacks", () => {
    var undoHistory1 = new b3editor.UndoStack();
    var undoHistory2 = new b3editor.UndoStack();

    var someObject = {};
    var someOtherObject = {foo: 25};

    undoHistory1.addCommand(makeTestCommand(() => {someObject.foo = "a string"}, () => {someObject.foo = undefined}));
    undoHistory2.addCommand(makeTestCommand(() => {someOtherObject.foo += 15}, () => {someOtherObject.foo -= 15}));

    assertStrictEqual("a string", someObject.foo);
    assertStrictEqual(40, someOtherObject.foo);

    undoHistory1.undoLastCommand();

    // Only someObject should be affected.
    assertStrictEqual(undefined, someObject.foo);
    assertStrictEqual(40, someOtherObject.foo);

    undoHistory2.undoLastCommand();

    // someOtherObject should be affected now.
    assertStrictEqual(undefined, someObject.foo);
    assertStrictEqual(25, someOtherObject.foo);
  }),
  makeTest("redoNextCommand basic functionality", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.undoLastCommand();

    undoHistory.redoNextCommand();

    // redoNextCommand should have redone what was undone.
    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("redoNextCommand until there are no more commands to redo", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = "a string"}, () => {someObject.bar = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 40}, () => {someObject.foo -= 40}));
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();

    // Should have no effect.
    undoHistory.redoNextCommand();
  }),
  makeTest("redoNextCommand when there are no commands", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.redoNextCommand();  // Should not throw any exceptions.
  }),
  makeTest("redoNextCommand after adding several commands", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {bar: "a string", baz: 1};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = 15}, () => {someObject.bar = "a string"}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.baz += 15}, () => {someObject.baz -= 15}));

    undoHistory.redoNextCommand();

    // The last command should have been done exactly once at this point.
    assertEqual(16, someObject.baz);
  }),
  makeTest("Calling addCommand after undoing several commands", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = "a string"}, () => {someObject.bar = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 40}, () => {someObject.foo -= 40}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.baz = true}, () => {someObject.baz = undefined}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.brown = true}, () => {someObject.brown = undefined}));

    undoHistory.redoNextCommand();

    // The redoNextCommand function should have no effect, and the addCommand function should have done something.
    assertStrictEqual(true, someObject.brown);
    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(undefined, someObject.baz);
  }),
  makeTest("Calling addCommand after undoing one command", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = "a string"}, () => {someObject.bar = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 40}, () => {someObject.foo -= 40}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.baz = true}, () => {someObject.baz = undefined}));

    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.brown = true}, () => {someObject.brown = undefined}));

    undoHistory.redoNextCommand();

    // The redoNextCommand function should have no effect, and the addCommand function should have done something.
    assertStrictEqual(true, someObject.brown);
    assertStrictEqual(65, someObject.foo);
    assertStrictEqual(undefined, someObject.baz);
  }),
  makeTest("Calling addCommand after adding (and undoing) one command", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));

    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.brown = true}, () => {someObject.brown = undefined}));

    undoHistory.redoNextCommand();

    // The redoNextCommand function should have no effect, and the addCommand function should have done something.
    assertStrictEqual(true, someObject.brown);
    assertStrictEqual(undefined, someObject.foo);
  }),
  makeTest("Calling addCommand after adding (and undoing) multiple commands", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = "a string"}, () => {someObject.bar = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 40}, () => {someObject.foo -= 40}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.baz = true}, () => {someObject.baz = undefined}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.brown = true}, () => {someObject.brown = undefined}));

    undoHistory.redoNextCommand();

    // The redoNextCommand function should have no effect, and the addCommand function should have done something.
    assertStrictEqual(true, someObject.brown);
    assertStrictEqual(undefined, someObject.foo);
  }),
  makeTest("Undo, redo, add command", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));

    undoHistory.undoLastCommand();
    undoHistory.redoNextCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.bar = 40}, () => {someObject.bar = undefined}));

    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(40, someObject.bar);
  })
]

module.exports = {testUndoStack: suite}