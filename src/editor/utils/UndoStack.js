this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class for keeping track of a list of past "commands" (singular actions that the user takes) performed and that 
   * enables them to be undone. An instance of this class is initialized as an empty list, and commands are added to the
   * stack using the addCommand() method, which takes in two no-args functions: the action for undoing and the action 
   * for redoing. The undoing / redoing occurs with undoLastCommand / redoLastCommand. Internally, the class keeps track
   * of the state of the undo history using a "cursor." undoLastCommand decrements this cursor and executes the command
   * at the resulting position. redoNextCommand increments the cursor and does the next command again. Note that since
   * this is a linear undo history, addCommand() will increment the cursor by one, replacing the command at that
   * position with the command to add (if applicable, otherwise simply appending the command), and removes all commands
   * that follow.
   * 
   * As a point of advice, one should make sure to handle references to variables outside of any functions fed into this
   * class; JavaScript will base references to external variables on the present variables at the time that the function
   * is called. If one wants to have some external references fed into a function, it is advised that one makes a
   * function that passes in those references as arguments and returns an inner function to be used in the construction
   * of a command.
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
   * Pushes a command onto the stack based on the provided command and undo action and increments the undo cursor
   * automatically. Also executes the `cmd` function immediately. If the cursor was not at the end of the stack, all 
   * commands following its former position will be removed from the stack. It is up to the programmer to ensure that
   * calling `undo` followed by calling `cmd` will result in zero side effects overall.
   * 
   * @param cmd the function to call to do or redo the command.
   * @param undo the function to call to undo the command.
   * @throws TypeError if `undo` or `cmd` is `null`, is `undefined`, or is not a function
   */
  p.addCommand = function(cmd, undo) {
    // If `cmd` is null, undefined, or not a function...
    if (!cmd || typeof cmd !== "function") {
      throw new TypeError("cmd is undefined or is not a function");
    }

    // If `undo` is null, undefined, or not a function...
    if (!undo || typeof undo !== "function") {
      throw new TypeError("undo is undefined or is not a function");
    }

    // Set the length to be this.cursor + 1. This will delete any entries that followed the position after the cursor.
    // It also leaves room for one command.
    this.stack.length = this.cursor + 1;
    // Set the entry at this.cursor to include the functions to undo / redo.
    this.stack[this.cursor] = {cmd: cmd, undo: undo};
    // Execute the redo command.
    this.stack[this.cursor].cmd();
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
   * Reperforms the command at the undo cursor and increments the cursor.
   */
  p.redoNextCommand = function() {
    // If the cursor is not at the end of the list...
    if (this.cursor < this.stack.length) {
      this.stack[this.cursor].cmd();  // Redo the command
      this.cursor++;  // And increment the cursor
    }
  }

  b3editor.UndoStack = UndoStack;
}());
