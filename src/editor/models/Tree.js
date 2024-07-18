this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Tree = b3.Class();
  var p = Tree.prototype;

  /**
   * Initializes the tree.
   * 
   * @param {object} args the arguments to supply
   * @param {number} args.maxStoredCommands the maximum number of commands that can be in the tree's undo history at once.
   */
  p.initialize = function(args) {
    this.id = 0;
    this.path = "";
    this.blocks = [];
    this.connections = [];
    this.selectedBlocks = [];
    this.undoHistory = new b3editor.UndoStack({maxLength: args.maxStoredCommands});
    this.camera = {
      "camera_x": 0,
      "camera_y": 0,
      "camera_z": 1,
      "x": 0,
      "y": 0
    }
    this.nameSinceLastSave = null;
  }

  b3editor.Tree = Tree;
}());
