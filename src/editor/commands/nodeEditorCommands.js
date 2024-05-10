this.b3editor = this.b3editor || {};

// Commands related to editing node definitions.

/**
 * A command representing adding the provided node to the provided editor's node list.
 */
b3editor.AddNode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.node = args.node;
  }

  /**
   * Adds the defined node to the editor node list.
   */
  p.run = function() {
    this.editor.addNode(this.node);
  }

  /**
   * Removes the defined node from the editor node list.
   */
  p.undo = function() {
    // TODO: consider the possibility of accidentally removing connections.
    this.editor.removeNode(this.node.name);
  }
})