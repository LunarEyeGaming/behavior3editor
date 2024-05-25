var {makeTest} = require("../tester");
var {assertThrows, assertEqual, assertStrictEqual, assert} = require("../assert");
var {makeTestCommand} = require("../testUtils")

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
]

module.exports = {testUndoStack: suite}