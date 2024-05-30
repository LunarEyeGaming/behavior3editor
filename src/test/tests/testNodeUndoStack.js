var {makeTest} = require("../tester");
var {assertStrictEqual, assert} = require("../assert");
var {makeTestCommand} = require("../testUtils");

// A simple NodeUndoStack
var exampleNUS1 = function() {
  var undoHistory = new b3editor.NodeUndoStack();
  var someObject = {};

  function addCommand(type, cmd, category) {
    undoHistory.addCommand([{originDirectory: "dir1", category, type}], cmd);
  }

  addCommand("action", makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}), "foo");
  addCommand("action", makeTestCommand(() => {someObject.bar = 25}, () => {someObject.bar = undefined}));
  addCommand("decorator", makeTestCommand(() => {someObject.baz = 25}, () => {someObject.baz = undefined}));
  addCommand("composite", makeTestCommand(() => {someObject.brains = 25}, () => {someObject.brains = undefined}));

  return {undoHistory, someObject}
}

// A more complex NodeUndoStack
var exampleNUS2 = function() {
  /*
  Hierarchy:
    dir1:
      action:
        [empty]
        foo
        bee
        sea
        wave
        ocean
        man
      decorator
      composite
    dir2:
      action:
        sea
        bar
        cellar
      decorator
  */
  var undoHistory = new b3editor.NodeUndoStack();
  var someObject = {};

  function addCommand(type, cmd, category) {
    undoHistory.addCommand([{originDirectory: "dir1", category, type}], cmd);
  }

  function addCommand2(type, cmd, category) {
    undoHistory.addCommand([{originDirectory: "dir2", category, type}], cmd);
  }

  addCommand("action", makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}), "foo");
  addCommand("action", makeTestCommand(() => {someObject.bar = 25}, () => {someObject.bar = undefined}));
  addCommand("decorator", makeTestCommand(() => {someObject.baz = 25}, () => {someObject.baz = undefined}));
  addCommand("composite", makeTestCommand(() => {someObject.brains = 25}, () => {someObject.brains = undefined}));
  addCommand("action", makeTestCommand(() => {someObject.bee = 25}, () => {someObject.bee = undefined}), "bee");

  addCommand2("action", makeTestCommand(() => {someObject.foo2 = 25}, () => {someObject.foo2 = undefined}), "bar");

  // Joint identifiers
  undoHistory.addCommand(
    [
      {originDirectory: "dir1", category: "sea", type: "action"},
      {originDirectory: "dir2", category: "sea", type: "action"}
    ], 
    makeTestCommand(() => {someObject.sea = 25}, () => {someObject.sea = undefined})
  );

  undoHistory.addCommand(
    [
      {originDirectory: "dir1", category: "sea", type: "action"},
      {originDirectory: "dir1", category: "wave", type: "action"}
    ], 
    makeTestCommand(() => {someObject.wave = 25}, () => {someObject.wave = undefined})
  );

  undoHistory.addCommand(
    [
      {originDirectory: "dir1", category: "ocean", type: "action"},
      {originDirectory: "dir1", category: "man", type: "action"}
    ], 
    makeTestCommand(() => {someObject.ocean = 25}, () => {someObject.ocean = undefined})
  );

  undoHistory.addCommand(
    [
      {originDirectory: "dir2", category: "cellar", type: "action"},
      {originDirectory: "dir2", type: "decorator"}
    ], 
    makeTestCommand(() => {someObject.cellar = 25}, () => {someObject.cellar = undefined})
  );

  return {undoHistory, someObject}
}

var suite = [
  makeTest("addCommand() basic functionality", () => {
    var undoHistory = new b3editor.NodeUndoStack();
    var someObject = {};

    function addCommand(type, cmd, category) {
      undoHistory.addCommand([{originDirectory: "dir1", category, type}], cmd);
    }

    addCommand("action", makeTestCommand(() => {someObject.foo = 25}, () => {someObject.foo = undefined}), "foo");
    addCommand("action", makeTestCommand(() => {someObject.bar = 25}, () => {someObject.bar = undefined}));
    addCommand("decorator", makeTestCommand(() => {someObject.baz = 25}, () => {someObject.baz = undefined}));
    addCommand("composite", makeTestCommand(() => {someObject.brains = 25}, () => {someObject.brains = undefined}));

    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(25, someObject.bar);
    assertStrictEqual(25, someObject.baz);
    assertStrictEqual(25, someObject.brains);
  }),
  makeTest("addCommand() handling of joint identifiers", () => {
    var undoHistory = new b3editor.NodeUndoStack();
    var someObject = {};

    undoHistory.addCommand(
      [
        {originDirectory: "dir1", category: "foo", type: "action"},
        {originDirectory: "dir1", category: "bar", type: "action"}
      ],
      makeTestCommand(() => {
        someObject.foo = 25;
        someObject.bar = 25;
      }, () => {
        someObject.foo = undefined;
        someObject.bar = undefined;
      })
    );

    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(25, someObject.bar);
  }),
  makeTest("addCommand() handling of duplicates in joint identifiers", () => {
    var undoHistory = new b3editor.NodeUndoStack();
    var someObject = {};

    undoHistory.addCommand(
      [
        {originDirectory: "dir1", category: "foo", type: "action"},
        {originDirectory: "dir1", category: "foo", type: "action"}
      ],
      makeTestCommand(() => {
        someObject.foo = 25;
      })
    );

    assertStrictEqual(25, someObject.foo);
  }),
  makeTest("undoLastCommand() and redoNextCommand() basic functionality", () => {
    var {undoHistory, someObject} = exampleNUS1();

    undoHistory.undoLastCommand();
    
    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(25, someObject.bar);
    assertStrictEqual(25, someObject.baz);
    assertStrictEqual(undefined, someObject.brains);

    undoHistory.redoNextCommand();
    
    assertStrictEqual(25, someObject.foo);
    assertStrictEqual(25, someObject.bar);
    assertStrictEqual(25, someObject.baz);
    assertStrictEqual(25, someObject.brains);
  }),
  makeTest("categoryIsSaved() basic functionality", () => {
    var {undoHistory} = exampleNUS2();

    assert(!undoHistory.categoryIsSaved("dir1", "foo"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir1", "bee"), "marked as saved");
    assert(undoHistory.categoryIsSaved("dir1", "bar"), "marked as unsaved");

    assert(undoHistory.categoryIsSaved("dir2", "foo"), "marked as unsaved");
    assert(!undoHistory.categoryIsSaved("dir2", "bar"), "marked as saved");
    assert(undoHistory.categoryIsSaved("dir2", "baz"), "marked as unsaved");
  }),
  makeTest("categoryIsSaved() accounts for joint identifiers", () => {
    var {undoHistory} = exampleNUS2();

    assert(!undoHistory.categoryIsSaved("dir1", "ocean"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir1", "man"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir2", "cellar"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir1", "wave"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir1", "sea"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir2", "sea"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir2", "decorator"), "marked as saved");

    assert(undoHistory.categoryIsSaved("dir1", "cellar"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("dir2", "ocean"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("dir2", "man"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("dir3", "sea"), "marked as unsaved");
  }),
  makeTest("categoryIsSaved() works for empty categories", () => {
    var undoHistory = new b3editor.NodeUndoStack();

    function addCommand(type, cmd, category) {
      undoHistory.addCommand([{originDirectory: "dir1", category, type}], cmd);
    }

    addCommand("action", makeTestCommand(() => {}, () => {}), "");

    assert(!undoHistory.categoryIsSaved("dir1", ""), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir1", "action"), "marked as saved");
  }),
  makeTest("commas and colons are properly handled", () => {
    var undoHistory = new b3editor.NodeUndoStack();

    // dir1:a\,b\:c,dir2:bb\,c\:dir3
    undoHistory.addCommand([
      {originDirectory: "dir1", type: "action", category: "a,b:c"},
      {originDirectory: "dir2", type: "action", category: "bb,c:dir3"}
    ], makeTestCommand(() => {}, () => {}));

    assert(!undoHistory.categoryIsSaved("dir1", "a,b:c"), "marked as saved");
    assert(!undoHistory.categoryIsSaved("dir2", "bb,c:dir3"), "marked as saved");

    assert(undoHistory.categoryIsSaved("b", "c"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("c", "dir3"), "marked as unsaved");

    assert(undoHistory.categoryIsSaved("b", "cdir2"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("b\\", "c"), "marked as unsaved");
    assert(undoHistory.categoryIsSaved("c\\", "dir3"), "marked as unsaved");
  }),
  makeTest("typeIsSaved() basic functionality", () => {
    var {undoHistory} = exampleNUS1();

    assert(!undoHistory.typeIsSaved("dir1", "action"), "marked as saved");
    assert(!undoHistory.typeIsSaved("dir1", "decorator"), "marked as saved");
    assert(!undoHistory.typeIsSaved("dir1", "composite"), "marked as saved");
    assert(undoHistory.typeIsSaved("dir1", "module"), "marked as unsaved");

    assert(undoHistory.typeIsSaved("dir2", "action"), "marked as unsaved");

    var undoHistory2 = new b3editor.NodeUndoStack();

    undoHistory2.addCommand(
      [{originDirectory: "dir1", type: "action", category: "foo"}],
      makeTestCommand(() => {}, () => {})
    );

    assert(!undoHistory.typeIsSaved("dir1", "action"), "marked as saved");
  }),
  makeTest("dirIsSaved() basic functionality", () => {
    var {undoHistory} = exampleNUS1();

    assert(!undoHistory.dirIsSaved("dir1"), "marked as saved");
    assert(undoHistory.dirIsSaved("dir2"), "marked as unsaved");
  }),
  makeTest("saveHierarchy() updates the right things", () => {
    var {undoHistory} = exampleNUS2();

    undoHistory.addCommand(
      [{originDirectory: "dir3", type: "action", category: "foo"}],
      makeTestCommand(() => {}, () => {})
    );
    undoHistory.addCommand(
      [{originDirectory: "dir3", type: "decorator"}],
      makeTestCommand(() => {}, () => {})
    );
    undoHistory.addCommand(
      [{originDirectory: "dir4", type: "action"}],
      makeTestCommand(() => {}, () => {})
    );

    undoHistory.saveHierarchy({
      dir1: {
        action: true,
        foo: true,
        bee: true,
        wave: false
      },
      dir3: {
        decorator: true,
        foo: false
      },
      dir4: {
        action: true
      }
    });

    var assertSaved = function(isSaved) {
      assert(isSaved, "marked as unsaved")
    };

    var assertUnsaved = function(isSaved) {
      assert(!isSaved, "marked as saved")
    };

    assertSaved(undoHistory.categoryIsSaved("dir1", "action"));
    assertSaved(undoHistory.categoryIsSaved("dir1", ""));
    assertSaved(undoHistory.categoryIsSaved("dir1", "foo"));
    assertSaved(undoHistory.categoryIsSaved("dir1", "bee"));
    assertUnsaved(undoHistory.categoryIsSaved("dir1", "sea"));
    assertUnsaved(undoHistory.categoryIsSaved("dir1", "wave"));
    assertUnsaved(undoHistory.categoryIsSaved("dir1", "ocean"));
    assertUnsaved(undoHistory.categoryIsSaved("dir1", "man"));
    
    assertUnsaved(undoHistory.categoryIsSaved("dir2", "bar"));
    assertUnsaved(undoHistory.categoryIsSaved("dir2", "sea"));
    assertUnsaved(undoHistory.categoryIsSaved("dir2", "cellar"));

    assertUnsaved(undoHistory.categoryIsSaved("dir3", "foo"));

    assertSaved(undoHistory.categoryIsSaved("dir4", "foo"));

    assertUnsaved(undoHistory.typeIsSaved("dir1", "action"));
    assertUnsaved(undoHistory.typeIsSaved("dir1", "composite"));
    assertUnsaved(undoHistory.typeIsSaved("dir1", "decorator"));
    assertSaved(undoHistory.typeIsSaved("dir1", "module"));

    assertUnsaved(undoHistory.typeIsSaved("dir2", "action"));
    assertSaved(undoHistory.typeIsSaved("dir2", "composite"));
    assertUnsaved(undoHistory.typeIsSaved("dir2", "decorator"));
    assertSaved(undoHistory.typeIsSaved("dir2", "module"));

    assertUnsaved(undoHistory.typeIsSaved("dir3", "action"));
    assertSaved(undoHistory.typeIsSaved("dir3", "composite"));
    assertSaved(undoHistory.typeIsSaved("dir3", "decorator"));
    assertSaved(undoHistory.typeIsSaved("dir3", "module"));

    assertSaved(undoHistory.typeIsSaved("dir4", "action"));
    assertSaved(undoHistory.typeIsSaved("dir4", "composite"));
    assertSaved(undoHistory.typeIsSaved("dir4", "decorator"));
    assertSaved(undoHistory.typeIsSaved("dir4", "module"));

    assertUnsaved(undoHistory.dirIsSaved("dir1"));
    assertUnsaved(undoHistory.dirIsSaved("dir2"));
    assertUnsaved(undoHistory.dirIsSaved("dir3"));
    assertSaved(undoHistory.dirIsSaved("dir4"));
    assertSaved(undoHistory.dirIsSaved("dir5"));
  }),
  makeTest("isSaved() basic functionality", () => {
    var undoHistory = new b3editor.NodeUndoStack();

    assert(undoHistory.isSaved(), "marked as unsaved");

    var undoHistory2 = exampleNUS2().undoHistory;

    assert(!undoHistory2.isSaved(), "marked as saved");

    undoHistory2.saveHierarchy({
      dir1: {
        action: true,
        foo: true,
        bee: true,
        sea: true,
        wave: true,
        ocean: true,
        man: true,
        decorator: true,
        composite: true
      },
      dir2: {
        sea: true,
        bar: true,
        cellar: true,
        decorator: true
      }
    });

    assert(undoHistory2.isSaved(), "marked as unsaved");
  }),
  makeTest("isSaved() edge cases", () => {
    var {undoHistory} = exampleNUS2();

    undoHistory.saveHierarchy({
      dir1: {
        action: true,
        foo: true,
        bee: true,
        sea: true,
        wave: true,
        ocean: true,
        man: true,
        decorator: true,
        composite: true
      },
      dir2: {
        sea: true,
        bar: true,
        cellar: true,
        decorator: false
      }
    });

    assert(!undoHistory.isSaved(), "marked as saved");

    var undoHistory2 = exampleNUS2().undoHistory;

    undoHistory2.saveHierarchy({
      dir1: {
        action: true,
        foo: true,
        bee: true,
        sea: true,
        wave: true,
        ocean: true,
        man: true,
        decorator: true,
        composite: true
      }
    });

    assert(!undoHistory2.isSaved(), "marked as saved");
  }),
  makeTest("isSaved() corner case", () => {
    var undoHistory = new b3editor.NodeUndoStack();

    undoHistory.addCommand(
      [{originDirectory: "dir1", category: "foo", type: "action"}],
      makeTestCommand(() => {}, () => {})
    );

    assert(!undoHistory.isSaved(), "marked as saved");
  })
]

module.exports = {testNodeUndoStack: suite}