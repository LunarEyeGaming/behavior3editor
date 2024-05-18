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
 * A command representing importing a set of nodes to the provided editor's node list.
 */
b3editor.ImportNodes = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.nodes = args.nodes;  // A list of objects each with the node to add and whether or not said node is an action.
  }

  p.run = function() {
    // Add the nodes.
    this.nodes.forEach(node => this.editor.addNode(node.nodeClass, node.isAction));
  }

  p.undo = function() {
    // Remove the nodes.
    this.nodes.forEach(node => this.editor.removeNode(node.nodeClass.prototype.name, node.isAction));
  }
})

/**
 * A command representing editing the provided node in the provided editor's node list.
 */
b3editor.EditNode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.oldName = args.oldName;  // The name of the node to change.
    this.node = this.editor.nodes[this.oldName];  // The target node to change.
    this.newNode = args.newNode;  // The changes to make.
    this.originDirectory = args.originDirectory;  // The new origin directory to use.
    this.oldOriginDirectory = this.node.prototype.originDirectory;
  
    // These are the original data of the node.
    this.oldChanges = {
      name: this.node.prototype.name,
      title: this.node.prototype.title,
      properties: this.node.prototype.properties,
      output: this.node.prototype.output,
      category: this.node.prototype.category,
      script: this.node.prototype.script
    };
  }

  p.run = function() {
    // Add the node, forcing the blocks to update their register status.
    this.editor.editNodeForce(this.oldName, this.newNode, this.originDirectory);
  }

  p.undo = function() {
    this.editor.editNodeForce(this.newNode.name, this.oldChanges, this.oldOriginDirectory);
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