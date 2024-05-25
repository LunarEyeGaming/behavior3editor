var {makeTest} = require("../tester");
var {assertThrows, assertEqual, assertStrictEqual, assert} = require("../assert");
var {makeTestCommand} = require("../testUtils")

var exampleWUS1 = function(defaultMaxLength) {
  var weavedUndoHistory = new b3editor.WeavedUndoStack({defaultMaxLength});

  var someObject = {};

  weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo = 25}, 
    () => {someObject.foo = undefined}));
  weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar = 50}, 
    () => {someObject.bar = undefined}));
  weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo += 123}, 
    () => {someObject.foo -= 123}));
  weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar += 123}, 
    () => {someObject.bar -= 123}));
  weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo -= 12}, 
    () => {someObject.foo += 12}));
  weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz = 75}, 
    () => {someObject.baz = undefined}));
  weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz += 123}, 
    () => {someObject.baz -= 123}));
  weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz -= 12}, 
    () => {someObject.baz += 12}));
  weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar -= 12}, 
    () => {someObject.bar += 12}));

  return {someObject, weavedUndoHistory};
};

var suite = [
  makeTest("addStack() basic functionality", () => {
    var weavedUndoHistory = new b3editor.WeavedUndoStack();

    weavedUndoHistory.addStack("foo");
    weavedUndoHistory.addStack("bar");
    weavedUndoHistory.addStack("baz");
  }),
  makeTest("addCommandToStack() basic functionality", () => {
    var weavedUndoHistory = new b3editor.WeavedUndoStack();

    var someObject = {};

    weavedUndoHistory.addStack("foo");
    weavedUndoHistory.addStack("bar");

    weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo = 25}, 
      () => {someObject.foo = undefined}));
    weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar = 50}, 
      () => {someObject.bar = undefined}));
    weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz = 75}, 
      () => {someObject.baz = undefined}));

    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(50, someObject.bar);
    assertStrictEqual(75, someObject.baz);
  }),
  makeTest("undoLastCommand() basic functionality", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1();

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(136, someObject.foo);
    assertStrictEqual(173, someObject.bar);
    assertStrictEqual(186, someObject.baz);
  }),
  makeTest("undoLastCommand() - remove full stack", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1();

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(173, someObject.bar);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(198, someObject.baz);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(75, someObject.baz);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(undefined, someObject.baz);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(148, someObject.foo);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(50, someObject.bar);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(25, someObject.foo);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(undefined, someObject.bar);

    weavedUndoHistory.undoLastCommand();
    assertStrictEqual(undefined, someObject.foo);
  }),
  makeTest("defaultMaxLength handling", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1(3);

    // New stack with a different limit.
    weavedUndoHistory.addStack("brains", 2);

    weavedUndoHistory.addCommandToStack("brains", makeTestCommand(() => {someObject.brains = 100}, 
      () => {someObject.brains = undefined}));
    weavedUndoHistory.addCommandToStack("brains", makeTestCommand(() => {someObject.brains += 123}, 
      () => {someObject.brains -= 123}));

    // All of these should exceed maxLength
    weavedUndoHistory.addCommandToStack("brains", makeTestCommand(() => {someObject.brains -= 12}, 
      () => {someObject.brains += 12}));
    weavedUndoHistory.addCommandToStack("brains", makeTestCommand(() => {someObject.brains += 1000}, 
      () => {someObject.brains -= 1000}));
    weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo += 1000}, 
      () => {someObject.foo -= 1000}));
    weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar += 1000}, 
      () => {someObject.bar -= 1000}));
    weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz += 1000}, 
      () => {someObject.baz -= 1000}));

    // Now, when we try to go back to the earliest state, brains should be 223, baz should be 75, bar should be 50, and
    // foo should be 25.
    for (var i = 0; i < 16; i++)
      weavedUndoHistory.undoLastCommand();

    // Make sure none of these are undefined.
    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(50, someObject.bar);
    assertStrictEqual(75, someObject.baz);
    assertStrictEqual(223, someObject.brains);
  }),
  makeTest("redoNextCommand() basic functionality", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1();

    weavedUndoHistory.undoLastCommand();
    weavedUndoHistory.undoLastCommand();
    weavedUndoHistory.undoLastCommand();
    weavedUndoHistory.undoLastCommand();

    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(75, someObject.baz);
  }),
  makeTest("redoing all actions after undoing them", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1();

    for (var i = 0; i < 9; i++)
      weavedUndoHistory.undoLastCommand();

    for (var i = 0; i < 9; i++)
      weavedUndoHistory.redoNextCommand();

    assertStrictEqual(136, someObject.foo);
    assertStrictEqual(161, someObject.bar);
    assertStrictEqual(186, someObject.baz);
  }),
  makeTest("Ensure maxLength is handled correctly when redoing", () => {
    var {weavedUndoHistory, someObject} = exampleWUS1(3);

    // Add some commands.
    weavedUndoHistory.addCommandToStack("foo", makeTestCommand(() => {someObject.foo += 1000}, 
      () => {someObject.foo -= 1000}));
    weavedUndoHistory.addCommandToStack("bar", makeTestCommand(() => {someObject.bar += 1000}, 
      () => {someObject.bar -= 1000}));
    weavedUndoHistory.addCommandToStack("baz", makeTestCommand(() => {someObject.baz += 1000}, 
      () => {someObject.baz -= 1000}));

    // Now try to undo all of them.
    for (var i = 0; i < 12; i++)
      weavedUndoHistory.undoLastCommand();

    // Now redo three actions.
    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(148, someObject.foo);
    assertStrictEqual(50, someObject.bar);
    assertStrictEqual(75, someObject.baz);

    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(148, someObject.foo);
    assertStrictEqual(173, someObject.bar);
    assertStrictEqual(75, someObject.baz);

    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(136, someObject.foo);
    assertStrictEqual(173, someObject.bar);
    assertStrictEqual(75, someObject.baz);

    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(136, someObject.foo);
    assertStrictEqual(173, someObject.bar);
    assertStrictEqual(198, someObject.baz);

    weavedUndoHistory.redoNextCommand();
    assertStrictEqual(136, someObject.foo);
    assertStrictEqual(173, someObject.bar);
    assertStrictEqual(186, someObject.baz);
  })
]

module.exports = {testWeavedUndoStack: suite}