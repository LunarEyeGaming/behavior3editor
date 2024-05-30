this.b3editor = this.b3editor || {};

/**
 * A Command that executes no code on its own, but it is used by the `WeavedUndoStack` class to help represent 
 * `Command`s affecting multiple stacks. Consequently, it should not be used anywhere else.
 */
b3editor.ChainCommand = b3editor.defineCommand((_, p) => {
  p.initialize = function() {
    // Do nothing.
  }

  p.run = function() {
    // Do nothing.
  }

  p.undo = function() {
    // Do nothing.
  }
})