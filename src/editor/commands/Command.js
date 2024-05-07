this.b3editor = this.b3editor || {};

(function () {
  "use strict";

  /**
   * An interface representing a command (or a singular action that a user takes). Due to the way that classes are 
   * constructed in this program, there is no direct way to represent an interface. Consequently, the methods in this
   * class are callable but will throw an exception to let the programmer know that they have to implement the method.
   * Programmers should instantiate subclasses of this class that implement all of the methods included in this one
   * properly (by overriding them). The interface of this class (and all subclasses) is the following:
   *   * run() - called when the command needs to be executed
   *   * undo() - called when the command needs to be undone
   * 
   * The programmer can have whatever constructors they need for subclasses. Please see subclasses of Command for examples
   * on how to implement this interface.
   */
  var Command = b3.Class();
  var p = Command.prototype;

  var notImplementedStub = function() {
    throw new ReferenceError("This function is not implemented. Please subclass Command and override the function.");
  }

  /**
   * Initializes a Command.
   */
  p.initialize = notImplementedStub;
  /**
   * Runs the command.
   */
  p.run = notImplementedStub;
  /**
   * Undoes the command.
   */
  p.undo = notImplementedStub;

  b3editor.Command = Command;
}());