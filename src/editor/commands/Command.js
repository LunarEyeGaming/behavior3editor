this.b3editor = this.b3editor || {};

(function () {
  "use strict";

  /**
   * An abstract class representing a command (or a singular action that a user takes). Due to the way that classes are 
   * constructed in this program, there is no direct way to represent an abstract class. Consequently, the methods in 
   * this class are callable but will throw an exception to let the programmer know that they have to implement the
   * method. Programmers should instantiate subclasses of this class that implement all of the methods included in this
   * one properly (by overriding them). The interface of this class (and all subclasses) is the following:
   *   * `Command.modifiesSaveData: boolean` - indicates whether or not the `Command` affects the save data of the
   *     corresponding file. Defaults to true.
   *   * `run(): () => void` - called when the command needs to be executed (when the command is first added)
   *   * `undo(): () => void` - called when the command needs to be undone
   *   * `redo(): () => void` - (optional) called when the command needs to be redone. Defaults to `run()`
   * 
   * The programmer can have whatever constructors they need for subclasses. Please see subclasses of `Command` for
   * examples on how to implement this interface.
   */
  var Command = b3.Class();
  var p = Command.prototype;

  var notImplementedStub = function() {
    throw new ReferenceError("This method is not implemented. Please subclass Command and override the method.");
  }

  Command.modifiesSaveData = true;

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
  /**
   * Redoes the command.
   */
  p.redo = function() {
    this.run();
  }

  /**
   * Defines a subclass of `Command` (using the `b3.Class` interface) and returns it.
   * 
   * Example:
   * ```
   * b3editor.TestCommand = b3editor.defineCommand((Class, p) => {
   *   p.initialize = function() {
   *     // ...
   *   }
   *   
   *   p.run = function() {
   *     // ...
   *   }
   * 
   *   p.undo = function() {
   *     // ...
   *   }
   *  
   *   Class.someStaticMethod = function() {
   *     // ...
   *   }
   * })
   * ```
   * 
   * @param {(any, object) => void} cmdDefiner the function to use when defining the subclass of `Command`.
   * @returns the subclass of `Command` defined.
   */
  b3editor.defineCommand = function(cmdDefiner) {
    // Make a subclass of Command.
    var cmdClass = b3.Class(b3editor.Command);

    // Pass the class and the prototype into cmdDefiner.
    cmdDefiner(cmdClass, cmdClass.prototype);

    return cmdClass;
  }

  b3editor.Command = Command;
}());