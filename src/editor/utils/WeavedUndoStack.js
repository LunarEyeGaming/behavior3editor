this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class that has a similar interface to UndoStack. As the name implies, this class is nearly identical to the
   * UndoStack class, except it allows for multiple independent save states. The way that this is done is by having
   * multiple UndoStacks that each have their own unique identifiers and by tracking the order in which the commands
   * were inserted in each stack. A stack can be added to this one via the addStack() method, which takes in an
   * identifier to use and creates a new UndoStack corresponding to that identifier. Commands can be added to a
   * particular stack through the addCommandToStack() method, which behaves identically to addCommand() in the UndoStack
   * class, except it also needs to take in an identifier argument to specify to which stack to add the Command. All
   * other methods of WeavedUndoStack that parallel UndoStack have a similar modification.
   * 
   * The exception to this pattern is undoLastCommand() and redoNextCommand(); instead of taking in an identifier
   * argument and acting upon the corresponding stack, it performs an undo / redo for the stack corresponding to the
   * command that was added to the WeavedUndoStack. For example, if "stack1", "stack2", and "stack3" were part of this
   * class and commands were added to "stack1", "stack3", "stack3", and "stack2", undoing four times would invoke the
   * undoLastCommand() method on "stack2", then "stack3", then "stack3", and then "stack1". redoNextCommand() would go
   * in reverse order. In addition, addCommandToStack() will purge undone Commands based on the order in which they have
   * been added within the WeavedUndoStack.
   * 
   * For more information on the individual methods, please see their corresponding documentation.
   */
  var WeavedUndoStack = b3.Class();
  var p = WeavedUndoStack.prototype;

  /**
   * Initializes a WeaveUndoStack.
   * 
   * @param {object?} args (optional) an object contining the arguments to use
   * @param {number?} args.defaultMaxLength (optional) the default max length to use when adding stacks.
   */
  p.initialize = function(args) {
    args = args || {};
  
    this.stacks = {};  // An object containing UndoStacks, keyed by identifiers.
    this.insertOrderCursor = null;  // A cursor pointing to the inside of a doubly-linked list.
    this.insertOrderHead = null;
    this.defaultMaxLength = args.defaultMaxLength;
  }

  /**
   * Adds a stack with ID `id` and an optional `maxLength` to the `WeavedUndoStack`. Overrides the previous stack with
   * an empty one if a stack with ID `id` is already defined.
   * 
   * @param {string} id the identifier of the stack to add
   * @param {number?} maxLength (optional) the `maxLength` to set for the `UndoStack` to add.
   * @throws TypeError if `maxLength` is not a number or the `defaultMaxLength` field is not a number
   * @throws RangeError if `maxLength` is not a positive number or the `defaultMaxLength` field is not a positive number
   */
  p.addStack = function(id, maxLength) {
    this.stacks[id] = new b3editor.UndoStack({maxLength: maxLength || this.defaultMaxLength});
  }

  /**
   * Adds a `Command` `cmd` to the stack with ID `id`. Like `UndoStack`, if there are any `Commands` that have been
   * undone, those will be purged from the `WeavedUndoStack`, so `Commands` from the individual stacks are "deleted".
   * 
   * @param {string} id the identifier of the stack to which to add the Command
   * @param {b3editor.Command} cmd the command to add
   * @throw TypeError if `id` is not a string or `cmd` is invalid
   */
  p.addCommandToStack = function(id, cmd) {
    // If `id` is not a string...
    if (typeof id !== "string") {
      throw new TypeError("id is not a string");
    }

    // Make a new node.
    var newNode = new b3editor.ListNode(id, null, this.insertOrderCursor);

    // If the cursor is not at the beginning of the list or in an empty list...
    if (this.insertOrderCursor !== null)
      // Appends to list if at the end; cuts off nodes following cursor otherwise.
      this.insertOrderCursor.next = newNode;
    else  // Otherwise...
      this.insertOrderHead = newNode;  // Update the head of the list.

    // This operation is equivalent to moving the cursor forward by one if the list is not empty and is equivalent to
    // creating the first element of the list otherwise.
    this.insertOrderCursor = newNode;

    // If the stack is not defined yet...
    if (!this.stacks[id])
      this.addStack(id);  // Add it.
    // Add the Command to the corresponding stack.
    this.stacks[id].addCommand(cmd);
  }

  /**
   * Executes `undoLastCommand()` for the stack corresponding to the last `Command` that was added and not undone.
   */
  p.undoLastCommand = function() {
    // If the cursor is not at the beginning of the list...
    if (this.insertOrderCursor !== null) {
      var success = this.stacks[this.insertOrderCursor.data].undoLastCommand();  // Undo the command.

      // If undoLastCommand() returned false (i.e., is already at the beginning of the list)...
      if (!success) {
        // Delete this entry.
        // If next is not null (such as being the last element in the list)...
        if (this.insertOrderCursor.next !== null)
          // Link next to skip this entry in backwards traversal
          this.insertOrderCursor.next.prev = this.insertOrderCursor.prev;
        
        // If prev is not null (such as being the first element in the list)...
        if (this.insertOrderCursor.prev !== null)
          // Link prev to skip this entry in forwards traversal
          this.insertOrderCursor.prev.next = this.insertOrderCursor.next;
        
        // If the current element happens to be the head...
        if (this.insertOrderCursor === this.insertOrderHead)
          // Move the head forward.
          this.insertOrderHead = this.insertOrderHead.next;
      }
      // Move back the cursor
      this.insertOrderCursor = this.insertOrderCursor.prev;
    }
  }

  // TODO: Test
  /**
   * Executes `redoNextCommand()` for the stack corresponding to the last `Command` that was undone.
   */
  p.redoNextCommand = function() {
    var target;  // The node corresponding to the Command to redo.

    // If the cursor is at the beginning of the list or in an empty list...
    if (this.insertOrderCursor !== null) {
      target = this.insertOrderCursor.next;
    } else {  // Otherwise...
      target = this.insertOrderHead;
    }

    // If the target is not null (i.e., the list is not empty when target === head; the cursor is not the last element 
    // otherwise)
    if (target !== null) {
      // Invoke redo on the stack corresponding to target's ID
      this.stacks[target.data].redoNextCommand();

      // Move the cursor forward.
      this.insertOrderCursor = target;
    }
  }

  /**
   * Returns whether or not the stack with ID `id` is saved.
   * 
   * @param {string} id the ID of the stack to check
   * @returns true if the stack corresponding to `id` is saved, false otherwise
   */
  p.stackIsSaved = function(id) {
    // If `id` is not a string...
    if (typeof id !== "string") {
      throw new TypeError("id is not a string");
    }

    return this.stacks[id].isSaved();
  }

  /**
   * Saves the stack with ID `id`.
   * 
   * @param {string} id the ID of the stack to save
   */
  p.saveStack = function(id) {
    // If `id` is not a string...
    if (typeof id !== "string") {
      throw new TypeError("id is not a string");
    }

    this.stacks[id].save();
  }

  b3editor.WeavedUndoStack = WeavedUndoStack;
}());