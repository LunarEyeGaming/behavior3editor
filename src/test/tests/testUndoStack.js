var {makeTest} = require("../tester");
var {assertThrows, assertEqual, assertStrictEqual, assert} = require("../assert");
var {makeTestCommand, makeTestCommandNoChange} = require("../testUtils")

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
    assert(undoHistory.undoLastCommand(), "undoLastCommand() returned false");

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

    // Should have no effect and should return false.
    assert(!undoHistory.undoLastCommand(), "undoLastCommand() returned true");

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
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assert(undoHistory.redoNextCommand(), "redoNextCommand() returned false");

    // redoNextCommand should have redone exactly one action.
    assertStrictEqual(50, someObject.foo);
  }),
  makeTest("redoNextCommand corner case: add one command, undo it, then redo it", () => {
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

    // Should have no effect and should return false.
    assert(!undoHistory.redoNextCommand(), "redoNextCommand() returned true");
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
  }),
  makeTest("maxLength basic functionality", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 3});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));

    // This one should cause the first command to get deleted.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));

    // All commands should be undone except the first one.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("maxLength invalid input handling", () => {
    assertThrows("TypeError", () => new b3editor.UndoStack({maxLength: "Not a Number!"}));
    assertThrows("RangeError", () => new b3editor.UndoStack({maxLength: -555}));
    assertThrows("RangeError", () => new b3editor.UndoStack({maxLength: -1}));
    assertThrows("RangeError", () => new b3editor.UndoStack({maxLength: 0}));
    assertThrows("TypeError", () => new b3editor.UndoStack({maxLength: NaN}));
  }),
  makeTest("length is properly tracked when culling the stack", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 3});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // This one should not cause the first command to get deleted. Length = 2 now.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 11}, () => {someObject.foo -= 11}));

    // All commands should be undone.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(undefined, someObject.foo);

    // Redoing and then adding more commands should not cause issues.
    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 13}, () => {someObject.foo -= 13}));

    // Should cause the first command to get deleted.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 13}, () => {someObject.foo -= 13}));

    assertStrictEqual(62, someObject.foo);

    // All commands except the first should be undone
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("length is properly tracked when culling the stack (and after undoing all commands)", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 3});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // This one should not cause the first command to get deleted. Length = 2 now.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 11}, () => {someObject.foo -= 11}));

    // All commands should be undone.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(undefined, someObject.foo);

    // Redoing and then adding more commands should not cause issues.
    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 13}, () => {someObject.foo -= 13}));

    // Should cause the first command to get deleted.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 13}, () => {someObject.foo -= 13}));

    assertStrictEqual(62, someObject.foo);

    // All commands except the first should be undone
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("length is properly tracked when maxLength is exceeded", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 3});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));

    // This one should cause the first command to get deleted. At this point, length should be 3 (not 4).
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 11}, () => {someObject.foo -= 11}));

    // Length should still be 3 after this series of actions. No commands should be deleted.
    undoHistory.undoLastCommand();
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 19}, () => {someObject.foo -= 19}));

    // All commands should be undone except the first one.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("maxLength = 1: Basic functionality", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 1});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));

    // This one should cause the first command to get deleted.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));

    // Only the second command should be undone.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("maxLength = 1: Undo", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 1});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.undoLastCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 16}, () => {someObject.foo = undefined}));

    // The second command should have been added without issue.
    assertStrictEqual(16, someObject.foo);

    // This one should cause the first command to get deleted.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 25}, () => {someObject.foo -= 25}));

    // Only the third command should be undone.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(16, someObject.foo);
  }),
  makeTest("maxLength = 1: Undo mixed with redo", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 1});

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.undoLastCommand();
    undoHistory.redoNextCommand();

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));

    // The second command should have been added without issue.
    assertStrictEqual(41, someObject.foo);

    // Only the second command should be undone.
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("isSaved() and save() basic functionality", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));

    // Should now be unsaved.
    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.save();

    // Should be saved now.
    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("isSaved() and save() undo and redo", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));

    undoHistory.save();

    // Undoing should mark as unsaved.
    undoHistory.undoLastCommand();

    assert(!undoHistory.isSaved(), "marked as saved");
    undoHistory.save();
    assert(undoHistory.isSaved(), "marked as unsaved");

    // Redoing should mark as unsaved.
    undoHistory.redoNextCommand();

    assert(!undoHistory.isSaved(), "marked as saved");
    undoHistory.save();
    assert(undoHistory.isSaved(), "marked as unsaved");

    // Undoing and redoing.
    undoHistory.undoLastCommand();
    undoHistory.redoNextCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("isSaved() and save() edge cases", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    // Should be saved right off the bat.
    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // Still should be saved.
    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.undoLastCommand();

    // Still should be saved.
    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();

    // Now should be unsaved.
    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.save();
    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));

    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("isSaved() and save() mixed with maxLength", () => {
    var undoHistory = new b3editor.UndoStack({maxLength: 3});

    var someObject = {};

    // Should be saved right off the bat.
    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 37}, () => {someObject.foo -= 37}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 49}, () => {someObject.foo -= 49}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // Should not be saved
    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("isSaved() and addCommand() purging", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 37}, () => {someObject.foo -= 37}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 49}, () => {someObject.foo -= 49}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 23}, () => {someObject.foo -= 23}));

    undoHistory.save();

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // This invocation of addCommand() will purge the commands following it.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 12}, () => {someObject.foo -= 12}));

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 18}, () => {someObject.foo -= 18}));

    // Should not be saved b/c the original series of commands has been erased.
    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("isSaved() and addCommand() purging (edge cases)", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 37}, () => {someObject.foo -= 37}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 49}, () => {someObject.foo -= 49}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 23}, () => {someObject.foo -= 23}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    // This invocation of addCommand() will purge the commands following it.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 12}, () => {someObject.foo -= 12}));

    // Should not be saved b/c the original series of commands has been erased.
    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 18}, () => {someObject.foo -= 18}));

    // Should not be saved b/c the original series of commands has been erased.
    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("isSaved() and addCommand() purging (corner case)", () => {
    var undoHistory = new b3editor.UndoStack();

    var someObject = {};

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 16}, () => {someObject.foo -= 16}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 37}, () => {someObject.foo -= 37}));
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 49}, () => {someObject.foo -= 49}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 23}, () => {someObject.foo -= 23}));

    undoHistory.undoLastCommand();

    // This invocation of addCommand() will purge the commands following it.
    undoHistory.addCommand(makeTestCommand(() => {someObject.foo += 12}, () => {someObject.foo -= 12}));

    // Should not be saved b/c the original series of commands has been erased.
    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("ensure that accessing modifiesSaveData works correctly for various subclassing levels from Command", () => {
    // Make barebones subclass of Command
    var TestCommand1 = b3.Class(b3editor.Command);
    TestCommand1.modifiesSaveData = false;
    TestCommand1.prototype.initialize = function() {};
    TestCommand1.prototype.run = function() {};
    TestCommand1.prototype.undo = function() {};

    // Make another barebones subclass of Command (must be direct)
    var TestCommand2 = b3.Class(b3editor.Command);
    TestCommand2.modifiesSaveData = true;
    TestCommand2.prototype.initialize = function() {};
    TestCommand2.prototype.run = function() {};
    TestCommand2.prototype.undo = function() {};

    // Subclass the second one.
    var TestCommand2_1 = b3.Class(TestCommand2);

    // Subclass above.
    var TestCommand2_1_1 = b3.Class(TestCommand2_1);

    // Now ensure that accessing modifiesSaveData works correctly.
    var undoHistory1 = new b3editor.UndoStack();

    undoHistory1.addCommand(new TestCommand1());

    assert(undoHistory1.isSaved(), "marked as unsaved");

    // TestCommand2
    var undoHistory2 = new b3editor.UndoStack();

    undoHistory2.addCommand(new TestCommand2());

    assert(!undoHistory2.isSaved(), "marked as saved");

    // TestCommand2_1
    var undoHistory3 = new b3editor.UndoStack();

    undoHistory3.addCommand(new TestCommand2_1());

    assert(!undoHistory3.isSaved(), "marked as saved");

    // TestCommand2_1_1
    var undoHistory4 = new b3editor.UndoStack();

    undoHistory4.addCommand(new TestCommand2_1_1());

    assert(!undoHistory4.isSaved(), "marked as saved");
  }),
  makeTest("modifiesSaveData handling: basic functionality", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.undoLastCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("modifiesSaveData handling: already unsaved", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.undoLastCommand();

    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.redoNextCommand();

    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("modifiesSaveData handling: multiple no-change commands", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("modifiesSaveData handling: restoring save status at the right time", () => {
    var undoHistory = new b3editor.UndoStack();

    for (var i = 0; i < 3; i++)
      undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.save();

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();  // First command undone that results in an unsaved state.

    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.redoNextCommand();  // Should now be saved.

    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("modifiesSaveData handling: more complex save status testing", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    for (var i = 0; i < 3; i++)
      undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.save();

    for (var i = 0; i < 3; i++)
      undoHistory.undoLastCommand();

    assert(!undoHistory.isSaved(), "marked as saved");

    // Now in the middle of the block of no-change commands.
    undoHistory.save();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();  // Now has redone a command that leads to an unsaved state.

    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("modifiesSaveData handling: edge case", () => {
    var undoHistory = new b3editor.UndoStack();

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.undoLastCommand();
    undoHistory.undoLastCommand();  // Shouldn't cause any problems.

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.redoNextCommand();
    undoHistory.redoNextCommand();  // Shouldn't cause any problems

    assert(undoHistory.isSaved(), "marked as unsaved");
  }),
  makeTest("modifiesSaveData handling: addCommand() purge", () => {
    var undoHistory = new b3editor.UndoStack();

    for (var i = 0; i < 3; i++)
      undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    undoHistory.addCommand(makeTestCommand(() => {}, () => {}));

    undoHistory.save();

    for (var i = 0; i < 3; i++)
      undoHistory.undoLastCommand();

    assert(!undoHistory.isSaved(), "marked as saved");

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(!undoHistory.isSaved(), "marked as saved");
  }),
  makeTest("modifiesSaveData handling: addCommand() purge 2", () => {
    var undoHistory = new b3editor.UndoStack();

    for (var i = 0; i < 3; i++)
      undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    undoHistory.save();

    for (var i = 0; i < 2; i++)
      undoHistory.undoLastCommand();

    assert(undoHistory.isSaved(), "marked as unsaved");

    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));
    undoHistory.addCommand(makeTestCommandNoChange(() => {}, () => {}));

    assert(undoHistory.isSaved(), "marked as unsaved");
  })
]

module.exports = {testUndoStack: suite}