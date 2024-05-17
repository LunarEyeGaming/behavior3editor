this.b3editor = this.b3editor || {};

// Commands related to editing node definitions.

/**
 * A command representing adding the provided node to the provided editor's node list.
 */
b3editor.AddNode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.node = args.node;  // The node to add.
    this.isAction = args.isAction;  // Whether or not the node is an action.
  }

  p.run = function() {
    // Add the node, forcing the blocks to update their register status.
    this.editor.addNode(this.node, this.isAction, true);
  }

  p.undo = function() {
    this.editor.removeNode(this.node.prototype.name, this.node.prototype.isAction);
  }
})

/**
 * A command representing removing the provided node from the provided editor's node list.
 */
b3editor.RemoveNode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.nodeName = args.node;  // The name of the node to remove.
    this.node = this.editor.nodes[this.nodeName];  // The node that will be removed.
    this.isAction = args.isAction;  // Whether or not the node is an action.
  }

  p.run = function() {
    this.editor.removeNode(this.nodeName, this.isAction);
  }

  p.undo = function() {
    this.editor.addNode(this.node, this.isAction, true);
  }
})