this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class that has a similar interface to `UndoStack`. As the name implies, this class is nearly identical to the 
   * `UndoStack` class, except it allows for multiple independent save states. The way that this is done is by having
   * multiple `UndoStacks` that each have their own unique identifiers and by tracking the order in which the `Command`s
   * were inserted in each stack. A stack can be added to this one via the `addStack()` method, which takes in an 
   * identifier to use and creates a new `UndoStack` corresponding to that identifier. `Command`s can be added to a
   * particular stack through the `addCommandToStack()` method, which behaves identically to `addCommand()` in the
   * `UndoStack` class, except it also needs to take in an identifier argument to specify to which stack to add the
   * `Command`. All other methods of `WeavedUndoStack` that parallel `UndoStack` methods have a similar modification.
   * 
   * The exception to this pattern is `undoLastCommand()` and `redoNextCommand()`; instead of taking in an identifier 
   * argument and acting upon the corresponding stack, it performs an undo / redo for the stack corresponding to the
   * `Command` that was added to the `WeavedUndoStack`. For example, if "stack1", "stack2", and "stack3" were part of
   * this class and `Command`s were added to "stack1", "stack3", "stack3", and "stack2", undoing four times would invoke
   * the `undoLastCommand()` method on "stack2", then "stack3", then "stack3", and then "stack1". `redoNextCommand()`
   * would go in reverse order. In addition, `addCommandToStack()` will purge undone `Command`s based on the order in
   * which they have been added within the `WeavedUndoStack`.
   * 
   * The `addCommandToStacks()` method also exists to add a `Command` across multiple stacks at once. The purpose of
   * this is to indicate that multiple components with associated undo stacks have been affected by a singular action
   * while also ensuring that the components can be saved independently (for example, we have a list of node groups and
   * want them to be saved independently but some actions affect more than one of these groups). `addCommandToStacks()`
   * adds a `Command` to only one of the given stacks in reality, with all the other given stacks only getting a 
   * `ChainCommand`, or `Command` that does not execute any code on its own. `undoLastCommand()` and `redoNextCommand()`
   * will undo / redo these `ChainCommand`s automatically.
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
   * @param {string} id the identifier of the stack to which to add the `Command`
   * @param {b3editor.Command} cmd the `Command` to add
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
   * Adds a `Command` `cmd` to the first stack in `ids` and adds `ChainCommand`s to the remaining IDs, acting as if a
   * `Command` that affects multiple stacks was given. Note that duplicate entries in `ids` will have no effect.
   * 
   * @param {string[]} ids the identifiers of the stacks to which to add the `Command`
   * @param {b3editor.Command} cmd the `Command` to add
   */
  p.addCommandToStacks = function(ids, cmd) {
    // Remove duplicates.
    ids = this._removeDuplicates(ids);

    // Get first and remaining IDs.
    var firstId = ids[0];
    var remainingIds = ids.slice(1);

    // Add ChainCommands to the remaining stacks.
    remainingIds.forEach(id => this.addCommandToStack(id, new b3editor.ChainCommand()));

    // Add `cmd` to the first stack.
    this.addCommandToStack(firstId, cmd);
  }

  /**
   * Executes `undoLastCommand()` for the stack corresponding to the last `Command` that was added and not undone. This
   * method is repeated if the `Command` that was undone was a `ChainCommand`.
   */
  p.undoLastCommand = function() {
    // If the cursor is not at the beginning of the list...
    if (this.insertOrderCursor !== null) {
      // Do the following once:
      do {
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
      }  // ...And then do it again for each time that there is an ID whose most recent Command is a `ChainCommand`.
      while (this.insertOrderCursor !== null && this.stacks[this.insertOrderCursor.data].hasChainCommand());
    }
  }

  /**
   * Executes `redoNextCommand()` for the stack corresponding to the last `Command` that was undone. This method is 
   * repeated if the `Command` that was redone was a `ChainCommand`.
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
      // Do the following:
      do {
        // Invoke redo on the stack corresponding to target's ID
        this.stacks[target.data].redoNextCommand();

        // Move the cursor forward.
        this.insertOrderCursor = target;

        // Update target.
        target = target.next;
      }  // ...And then do it again for each time that the current stack's most recent Command is a `ChainCommand`.
      while (this.stacks[this.insertOrderCursor.data].hasChainCommand());
    }
  }

  /**
   * Returns whether or not the stack with ID `id` is saved. Returns `true` if the stack is not defined yet.
   * 
   * @param {string} id the ID of the stack to check
   * @returns true if the stack corresponding to `id` is saved (or undefined), false otherwise
   */
  p.stackIsSaved = function(id) {
    // If `id` is not a string...
    if (typeof id !== "string") {
      throw new TypeError("id is not a string");
    }

    // Return true if this.stacks[id] is not defined or it is saved.
    return !this.stacks[id] || this.stacks[id].isSaved();
  }

  /**
   * Saves the stack with ID `id`. Has no effect if the stack with ID `id` is not defined.
   * 
   * @param {string} id the ID of the stack to save
   */
  p.saveStack = function(id) {
    // If `id` is not a string...
    if (typeof id !== "string") {
      throw new TypeError("id is not a string");
    }

    // If the stack corresponding to `id` is defined...
    if (this.stacks[id])
      // Save it.
      this.stacks[id].save();
  }

  /**
   * Maps a function over the stack IDs.
   * 
   * @param {(string) => any} callback the function to call for each stack ID.
   */
  p.stackIdMap = function(callback) {
    var results = [];

    // For each ID in the list of stacks...
    for (var id in this.stacks) {
      // Feed the ID into the callback function and add the result to results.
      results.push(callback(id));
    }

    return results;
  }

  /**
   * Builds a copy of `ids` with all duplicates removed and returns it.
   * 
   * @param {string[]} ids the list of IDs from which to remove duplicates
   * @returns `ids` with all duplicates removed.
   */
  p._removeDuplicates = function(ids) {
    var newIds = [];
    var idLookupTable = {};

    // For each ID in ids...
    ids.forEach(id => {
      // If id is not in the lookup table...
      if (!idLookupTable[id]) {
        // Add it to the lookup table.
        idLookupTable[id] = true;
        // Add it to newIds.
        newIds.push(id);
      }
    });

    return newIds;
  }

  b3editor.WeavedUndoStack = WeavedUndoStack;
}());