var {makeTest} = require("../tester");
var {assertThrows, assertEqual, assertStrictEqual} = require("../assert");

var suite = [
    makeTest("addCommand basic functionality", () => {
        var undoHistory = new b3editor.UndoStack();
        var someObject = {};
    
        undoHistory.addCommand(() => {}, () => {someObject.foo = "bar"});

        // Make sure that the redo command has been executed.
        assertEqual("bar", someObject.foo);
    }),
    makeTest("addCommand throws error on null, undefined, or otherwise invalid 'undo' argument", () => {
        var undoHistory = new b3editor.UndoStack();
        assertThrows("TypeError", () => undoHistory.addCommand(undefined, () => {}));
        assertThrows("TypeError", () => undoHistory.addCommand(null, () => {}));
        assertThrows("TypeError", () => undoHistory.addCommand("Not a function", () => {}));
    }),
    makeTest("addCommand throws error on null, undefined, or otherwise invalid 'redo' argument", () => {
        var undoHistory = new b3editor.UndoStack();
        assertThrows("TypeError", () => undoHistory.addCommand(() => {}, undefined));
        assertThrows("TypeError", () => undoHistory.addCommand(() => {}, null));
        assertThrows("TypeError", () => undoHistory.addCommand(() => {}, "Not a function"));
    }),
    makeTest("undo basic functionality", () => {
        var undoHistory = new b3editor.UndoStack();
        var someObject = {};

        undoHistory.addCommand(() => {someObject.foo = undefined}, () => {someObject.foo = "bar"});
        undoHistory.undoLastCommand();

        // Make sure that someObject.foo has been deleted.
        assertStrictEqual(undefined, someObject.foo);
    })
]

module.exports = {testUndoStack: suite}