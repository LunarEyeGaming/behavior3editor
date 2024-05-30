this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class for keeping track of a list of past Commands (see Command.js for more information) performed and that
   * enables them to be undone. It is an implementation of the linear undo model (see 
   * https://en.wikipedia.org/wiki/Undo, section "Linear undo," for more information) that can optionally have a maximum
   * size. In more detail, an instance of this class is a doubly-linked list without sentinels (the reader need not 
   * worry about what sentinels are), so the ends of the list are signified by `null`. Individual nodes in the list are
   * instances of the `ListNode` class. See documentation above for more details. An `UndoStack` instance is 
   * initialized as an empty list, with an optional `maxLength` given in an `args` object that is passed into the 
   * constructor. `maxLength` signifies the maximum length of the list, and if the list exceeds that length, the the
   * oldest `Command` in the stack (i.e., the first one) will be removed. Each instance also has a `cursor`, which points
   * to the last `Command` executed that was not undone (or `null` in the case of an empty list).
   * 
   * The `addCommand()` method invokes the `run()` method of a given `Command` and adds it to the stack at the position 
   * immediately following the `cursor`, deleting any subsequent `Command`s if present. The `undoLastCommand()` invokes
   * the `undo()` method of the `Command` corresponding to the `cursor` and moves the `cursor` back by one. The
   * `redoNextCommand()` invokes the `run()` method (or the `redo()` method if defined) of the `Command` corresponding
   * to the node following the `cursor` and moves the `cursor` forward by one. Please see the documentation of the 
   * aforementioned methods for more detail.
   * 
   * Each `UndoStack` instance also has a "save cursor," which is the location of the cursor when the associated file
   * (which the programmer determines via external means) was last saved. The associated file is considered to be
   * "saved" if the save cursor matches the actual cursor, and the programmer can check if the file is saved using the 
   * `isSaved()` method. The save cursor can be updated to match the actual cursor using the `save()` method.
   * 
   * As a point of advice, one should make sure to handle references to variables outside of any functions fed into this
   * class; JavaScript will base references to external variables on the present variables at the time that the function
   * is called. If one wants to have some external references fed into a function, it is advised that one makes a
   * function that passes in those references as arguments and returns an inner function to be used in the construction
   * of a Command.
   * 
   * Internally, the class also contains the `head`, which points to the first node in the list (or `null` when the list
   * is empty), `length` to track the length of the list, and `cursorPos` to track the index of the cursor (to update
   * the length of the list properly; -1 if the cursor has no position). Usually, it is not recommended that the
   * programmer access the fields of this class, and the methods of this class operate under the assumption that the
   * programmer follows this recommendation.
   * 
   * For use by the `WeavedUndoStack`, this class has the `hasChainCommand()` method, which returns whether or not the
   * last executed `Command` that was not undone is a `ChainCommand`.
  **/
  var UndoStack = b3.Class();
  var p = UndoStack.prototype;

  /**
   * Initializes an `UndoStack` to have an empty stack and a cursor set to 0.
   * 
   * @param {number} maxLength (optional) the maximum length of the stack.
   * @throws TypeError if `maxLength` is not a number
   * @throws RangeError if `maxLength` is not a positive number
   */
  p.initialize = function(args) {
    // Triggered only if args and args.maxLength are defined.
    if (args && args.maxLength !== undefined) {
      if (typeof args.maxLength !== "number" || isNaN(args.maxLength))
        throw new TypeError("maxLength is not a number.");

      if (args.maxLength <= 0)
        throw new RangeError("maxLength is not a positive value.");
  
      this.maxLength = args.maxLength;
    }

    // Initialize to empty doubly-linked list.
    this.head = null;  
    this.cursor = null;
    this.cursorPos = -1;
    this.length = 0;
    this.saveCursorPos = -1;
    this.numRemoved = 0;
  }

  /**
   * Pushes a `Command` `cmd` onto the stack and increments the undo cursor automatically. Also executes the `run()` 
   * method of the `Command` immediately. If the cursor was not at the end of the stack, all Commands following its 
   * former position will be removed from the stack. It is up to the programmer to ensure that following an invocation
   * of the `run()` method with an invocation of the `undo()` method reverses the state of the editor and that following
   * that invocation with a `redo()` method call (or another `run()` method call if `redo()` is not defined) will lead
   * to the same result as simply calling `run()`.
   * 
   * @param cmd the `Command` to add.
   * @throws TypeError if `cmd` is `null`, is `undefined`, or is not an instance of Command
   */
  p.addCommand = function(cmd) {
    // If `cmd` is null, undefined, or not an instance of Command...
    if (!cmd || !(cmd instanceof b3editor.Command)) {
      throw new TypeError("cmd is undefined, is null, or is not a Command");
    }

    // Run the command.
    cmd.run();

    // Make a new node.
    var newNode = new b3editor.ListNode(cmd, null, this.cursor);

    // If the cursor is not at the beginning of the list or in an empty list...
    if (this.cursor !== null)
      this.cursor.next = newNode;  // Appends to list if at the end; cuts off nodes following cursor otherwise.
    else  // Otherwise...
      this.head = newNode;  // Update the head of the list.

    // Both operations are equivalent to moving the cursor forward by one if the list is not empty and are equivalent to
    // creating the first element of the list otherwise.
    this.cursor = newNode;
    this.cursorPos++;

    this.length = this.cursorPos + 1;  // Update length to be correct.

    // If the max length is defined and the length exceeds it...
    if (this.maxLength && this.length > this.maxLength) {
      // Update head and then unlink the new head from the old head.
      this.head = this.head.next;
      this.head.prev = null;
      // Unlinking the `next` reference from the old head is unnecessary assuming no references to it remain.

      // length should exceed maxLength by 1 anyways, so this should be fine.
      this.length--;
      this.cursorPos--;  // cursorPos should be updated too.
      this.numRemoved++;  // Update the number of removed commands.
    }
  }

  /**
   * Invokes the `undo()` method of the `Command` at the cursor and moves the cursor back by one `Command`. Has no
   * effect if the cursor is already at the beginning of the list.
   * 
   * @returns true if the undo action was successful (i.e., caused `undo()` to be run), false otherwise
   */
  p.undoLastCommand = function() {
    var result;

    // If the cursor is not at the beginning of the list...
    if (this.cursor !== null) {
      this.cursor.data.undo();  // Undo the command.

      // Move back the cursor
      this.cursor = this.cursor.prev;
      this.cursorPos--;

      result = true;
    } else
      result = false;
    
    return result;
  }

  /**
   * Reperforms the `Command` at the node immediately following the undo cursor and moves the cursor forward by one 
   * `Command`. Reperforming the `Command` involves either running the `redo()` method, if defined, or running the 
   * `run()` method otherwise. If there are no actions to redo, this method will have no effect.
   * 
   * @returns true if the undo action was successful (i.e., caused `undo()` to be run), false otherwise
   */
  p.redoNextCommand = function() {
    var target;  // The node corresponding to the Command to redo.
    var result;

    // If the cursor is at the beginning of the list or in an empty list...
    if (this.cursor !== null) {
      target = this.cursor.next;
    } else {  // Otherwise...
      target = this.head;
    }

    // If the target is not null (i.e., the list is not empty when target === head; the cursor is not the last element 
    // otherwise)
    if (target !== null) {
      // If the redo method is defined...
      if (target.data.redo) {
        target.data.redo();  // Use it
      } else {  // Otherwise...
        target.data.run();  // Use the run method
      }

      // Move the cursor forward.
      this.cursor = target;
      this.cursorPos++;

      result = true;
    } else
      result = false;
    
    return result;
  }

  /**
   * Returns whether or not the save cursor matches the actual cursor.
   * 
   * @returns true if the save cursor matches the actual cursor, false otherwise.
   */
  p.isSaved = function() {
    // this.cursorPos + this.numRemoved (the number of commands removed) gives the true cursor position.
    return this.saveCursorPos == this.cursorPos + this.numRemoved;
  }

  /**
   * Sets the save cursor to the actual cursor.
   */
  p.save = function() {
    // this.cursorPos + this.numRemoved (the number of commands removed) gives the true cursor position.
    this.saveCursorPos = this.cursorPos + this.numRemoved;
  }

  /**
   * Returns whether or not the most recently executed `Command` that was not undone exists and is a `ChainCommand`.
   * 
   * @returns true if there was a most recently executed `Command` that was not undone and said executed `Command` was a
   * `ChainCommand`, false otherwise
   */
  p.hasChainCommand = function() {
    return this.cursor !== null && this.cursor.data instanceof b3editor.ChainCommand;
  }

  b3editor.UndoStack = UndoStack;
}());
