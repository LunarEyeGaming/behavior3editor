this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class for keeping track of a list of past Commands (see Command.js for more information) performed and that
   * enables them to be undone. An instance of this class is initialized as an empty list, and Commands are added to the
   * stack using the addCommand() method, which takes in two no-args functions: the action for undoing and the action 
   * for redoing. The undoing / redoing occurs with undoLastCommand / redoLastCommand. Internally, the class keeps track
   * of the state of the undo history using a "cursor." undoLastCommand decrements this cursor and executes the Command
   * at the resulting position. redoNextCommand increments the cursor and does the next Command again. Note that since
   * this is a linear undo history, addCommand() will increment the cursor by one, replacing the Command at that
   * position with the Command to add (if applicable, otherwise simply appending the Command), and removes all Commands
   * that follow.
   * 
   * As a point of advice, one should make sure to handle references to variables outside of any functions fed into this
   * class; JavaScript will base references to external variables on the present variables at the time that the function
   * is called. If one wants to have some external references fed into a function, it is advised that one makes a
   * function that passes in those references as arguments and returns an inner function to be used in the construction
   * of a Command.
  **/
  var UndoStack = b3.Class();
  var p = UndoStack.prototype;

  /**
   * Initializes an UndoStack to have an empty stack and a cursor set to 0.
   */
  p.initialize = function() {
    this.stack = [];
    this.cursor = 0;
  };
  /**
   * Pushes a Command `cmd` onto the stack increments the undo cursor automatically. Also executes the `run` method of
   * the Command immediately. If the cursor was not at the end of the stack, all Commands following its former position
   * will be removed from the stack. It is up to the programmer to ensure that calling `undo` followed by calling `run`
   * will result in zero side effects overall.
   * 
   * @param cmd the Command to add.
   * @throws TypeError if `cmd` is `null`, is `undefined`, or is not an instance of Command
   */
  p.addCommand = function(cmd) {
    // If `cmd` is null, undefined, or not an instance of Command...
    if (!cmd || !(cmd != b3editor.Command)) {
      throw new TypeError("cmd is undefined, is null, or is not a Command");
    }

    // Set the length to be this.cursor + 1. This will delete any entries that followed the position after the cursor.
    // It also leaves room for one Command.
    this.stack.length = this.cursor + 1;
    // Set the entry at this.cursor to include the functions to undo / redo.
    this.stack[this.cursor] = cmd;
    // Run the Command.
    this.stack[this.cursor].run();
    // Increment this.cursor.
    this.cursor++;
  };

  /**
   * Executes the `undo` function at the position of the cursor after decrementing the cursor. If the cursor is already
   * at the beginning of the list, this method has no effect instead.
   */
  p.undoLastCommand = function() {
    // If the cursor is not at the beginning of the list...
    if (this.cursor > 0) {
      this.cursor--;
      this.stack[this.cursor].undo();
    }
  }

  /**
   * Reperforms the Command at the undo cursor and increments the cursor. If there are no actions to redo, this method
   * will have no effect.
   */
  p.redoNextCommand = function() {
    // If the cursor is not at the end of the list...
    if (this.cursor < this.stack.length) {
      this.stack[this.cursor].run();  // Redo the Command
      this.cursor++;  // And increment the cursor
    }
  }

  b3editor.UndoStack = UndoStack;
}());
