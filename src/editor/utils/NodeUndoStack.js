this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class that encapsulates the `WeavedUndoStack` class to handle the numerous Commands that can be performed with
   * node definitions, modeled similarly to the editor's export hierarchy. In other words, there are two identifiable
   * levels to the hierarchy: save locations and group identifiers. With "group identifiers," either a category or a 
   * type can be a group identifier (not concise enough). When adding any Command to this class through the `addCommand()` 
   * method, the affected node groups must be identified by a group identifier and save location. Multiple node groups
   * can be affected, so more than one identifier can be inputted. See documentation for `addCommand()` for more
   * details.
   * 
   * `undoLastCommand()` and `redoNextCommand()` simply expose access to the inner `WeavedUndoStack`'s respective
   * methods.
   * 
   * Three kinds of commands exist to check save status at different levels. `dirIsSaved()` checks for save status at 
   * the directory level; `typeIsSaved()` checks for save status at the type level; and `categoryIsSaved()` checks for
   * save status at the category level, only being applicable to "action" nodes.
   * 
   * If a Command uses a category as a group identifier, it is assumed that the type is "action".
   */
  var NodeUndoStack = b3.Class();
  var p = NodeUndoStack.prototype;

  /* ================================================================================================================
   * PUBLIC FACING METHODS
   * ================================================================================================================ */
  /**
   * Initializes a `NodeUndoStack` instance.
   * 
   * @param {object?} args an object containing some arguments to provide.
   * @param {number?} args.defaultMaxLength the default max length to use.
   */
  p.initialize = function(args) {
    args = args || {};

    this.undoStack = new b3editor.WeavedUndoStack({defaultMaxLength: args.defaultMaxLength});
    this.dirCategories = {};
    this.originDirectories = [];
  }

  /**
   * Adds `Command` `cmd` to the undo stack, associating `affectedGroups` with it.
   * 
   * @param {object[]} affectedGroups the list of node groups affected by adding the Command.
   * @param {b3editor.Command} cmd the Command to add.
   */
  p.addCommand = function(affectedGroups, cmd) {
    // Cache categories associated with the originDirectory attribute of each affected group.
    this._cacheCategories(affectedGroups);

    // Add each origin directory to the list of origin directories (if not already included).
    affectedGroups.forEach(group => {
      if (!this.originDirectories.includes(group.originDirectory))
        this.originDirectories.push(group.originDirectory);
    });

    // Get undo hash strings, then feed into `WeavedUndoStack.addCommandToStack()`.
    var undoHashes = this._getUndoHashes(affectedGroups);
    this.undoStack.addCommandToStacks(undoHashes, cmd);
  }

  /**
   * Calls `undoLastCommand()` on the inner `WeavedUndoStack`.
   */
  p.undoLastCommand = function() {
    this.undoStack.undoLastCommand();
  }

  /**
   * Calls `redoNextCommand()` on the inner `WeavedUndoStack`.
   */
  p.redoNextCommand = function() {
    this.undoStack.redoNextCommand();
  }

  /**
   * Returns whether or not all nodes of category `category` in save location `originDirectory` are saved--that is, all
   * identifiers relating to `originDirectory` and `category` have a saved undo history (or none at all).
   * 
   * @param {string} originDirectory the save location in which to check
   * @param {string} category the category to check
   * @returns true if all nodes of category `category` in save location `originDirectory` are saved, false otherwise
   */
  p.categoryIsSaved = function(originDirectory, category) {
    // Get undo hash string.
    var [undoHash] = this._getUndoHashes([{originDirectory, category, type: "action"}]);

    // Return whether or not the stack corresponding to `undoHash` is saved.
    return this.undoStack.stackIsSaved(undoHash);
  }

  /**
   * Returns whether or not the nodes of type `type` in save location `originDirectory` are saved.
   * 
   * @param {string} originDirectory the save location in which to check
   * @param {string} type the name of the type to check
   * @returns true if the nodes of type `type` in save location `originDirectory` are saved, false otherwise
   */
  p.typeIsSaved = function(originDirectory, type) {
    // If type is equal to action...
    if (type == "action") {
      // If the list of categories associated with originDirectory is undefined...
      if (!this.dirCategories[originDirectory])
        // Consider it to be saved.
        return true;

      // For each category corresponding to the originDirectory...
      for (var i = 0; i < this.dirCategories[originDirectory].length; i++) {
        var category = this.dirCategories[originDirectory][i];
        // If the category is not saved...
        if (!this.categoryIsSaved(originDirectory, category))
          // Stop and return false.
          return false;
      }

      // Return true since we iterated through all the categories and none of them are unsaved.
      return true;
    } else {
      // Checking if all nodes of a type are saved in this case is identical to checking if all nodes of a category with
      // the value of the type are saved.
      return this.categoryIsSaved(originDirectory, type);
    }
  }

  /**
   * Returns whether or not all nodes in directory `originDirectory` are saved.
   * 
   * @param {string} originDirectory the save location to check
   * @returns true if all nodes in directory `originDirectory` are saved, false otherwise
   */
  p.dirIsSaved = function(originDirectory) {
    // originDirectory is saved if and only if all types corresponding to it are saved.
    return this.typeIsSaved(originDirectory, "action") && this.typeIsSaved(originDirectory, "composite") && 
      this.typeIsSaved(originDirectory, "decorator") && this.typeIsSaved(originDirectory, "module");
  }
  
  /**
   * Returns whether or not the current `NodeUndoStack` is saved--i.e., has no unsaved directories.
   * 
   * @returns true if no directory in the current `NodeUndoStack` is unsaved, false otherwise
   */
  p.isSaved = function() {
    // For each originDirectory in dirCategories...
    for (var i = 0; i < this.originDirectories.length; i++) {
      var originDirectory = this.originDirectories[i];
      // If the directory is not saved...
      if (!this.dirIsSaved(originDirectory))
        // Stop and return false.
        return false;
    }

    // Return true here as there are no unsaved directories.
    return true;
  }

  /**
   * Marks the node groups in `NodeUndoStack` included in `exportHierarchy` as saved.
   * 
   * @param {object.<string, object.<string, bool>>} exportHierarchy the export hierarchy to use, where each key is an
   * `originDirectory` and each value is a nested object, which binds a `category` to `true` if the category should be
   * exported.
   */
  p.saveHierarchy = function(exportHierarchy) {
    // For each originDirectory in the export hierarchy...
    for (var originDirectory in exportHierarchy) {
      var exportCategories = exportHierarchy[originDirectory];

      // For each category / type in the list of categories to export corresponding to originDirectory...
      for (var category in exportCategories) {
        // If the category should be exported...
        if (exportCategories[category]) {
          var [undoHash] = this._getUndoHashes([{originDirectory, category}]);  // Get undoHash.
          this.undoStack.saveStack(undoHash);  // Save.
        }
      }
    }
  }

  /* ================================================================================================================
   * HELPER METHODS
   * ================================================================================================================ */
  /**
   * Helper method. Returns a list of string representations of one or more node groups. In the string representation,
   * the node group has either the `category` or the `type` be used, with `category` being used only if it is defined. 
   * Within the resulting string, all colons that are originally present in any `originDirectory`, `category`, and/or 
   * `type` are preceded with a backslash. Existing backslashes are also preceded with a backslash.
   * 
   * @param {object[]} affectedGroups the affected groups to convert into a hash string
   * @param {string} affectedGroups[].originDirectory the origin directory to use
   * @param {string} affectedGroups[].category the category to use as a group ID
   * @param {string} affectedGroups[].type the type to use as the substitute for the category as a group ID
   * @returns a list of hash strings to use for `addCommand()` and for looking up the `UndoStack`s associated with the
   * hashes.
   */
  p._getUndoHashes = function(affectedGroups) {
    // Return hash string list made by going through each entry in affectedGroups...
    return affectedGroups.map(({originDirectory, category, type}) => {
      // ...Escaping commas, colons, and backslashes in all strings...
      var originDirectoryEscaped = this._escapeString(originDirectory);
      var categoryOrTypeEscaped = this._escapeString(category || type);  // Easier to choose one now than later

      // ...Forming a hash, and then returning.
      return originDirectoryEscaped + ":" + categoryOrTypeEscaped;
    });
  }

  /**
   * Returns a copy of `str` with all colons and backslashes preceded with backslashes.
   * 
   * @param {string} str the string to escape.
   * @returns the string with all colons and backslashes preceded with backslashes.
   */
  p._escapeString = function(str) {
    return str.replace(/(:|\\)/g, "\\$1");
  }

  /**
   * Stores the associations between origin directories and categories for later use. Does not include categories from
   * entries of `affectedGroups` whose `type` is not "action".
   * @param {object[]} affectedGroups the affected groups from which to cache category associations
   * @param {string} affectedGroups[].originDirectory the origin directory to use
   * @param {string} affectedGroups[].category the category to cache
   * @param {string} affectedGroups[].type the type to check
   */
  p._cacheCategories = function(affectedGroups) {
    // For each group in affectedGroups...
    affectedGroups.forEach(group => {
      // If the type attribute is "action"...
      if (group.type === "action") {
        // If the entry corresponding to originDirectory is not defined...
        if (!this.dirCategories[group.originDirectory])
          this.dirCategories[group.originDirectory] = [];

        // Associate category (or type by default) with originDirectory.
        this.dirCategories[group.originDirectory].push(group.category || group.type);
      }
    })
  }

  b3editor.NodeUndoStack = NodeUndoStack;
}());