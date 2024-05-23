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
    // Add the node, forcing the blocks to update their register status. Store the resulting rollback data.
    this.rollbackData = this.editor.addNode(this.node, this.isAction, true);
  }

  p.undo = function() {
    // Remove the node (blocks are redrawn later, so removeNode is forced not to redraw them).
    this.editor.removeNode(this.node.prototype.name, this.node.prototype.isAction, false);

    // Reverse the changes made by adding the node.
    // Reset the data for each affected block (and redraw it).
    this.rollbackData.originalBlocks.forEach(originalBlock => {
      originalBlock.block.setNodeAttributes(originalBlock.originalData);
      originalBlock.block.redraw(false);
    });
  }
})

/**
 * A command representing importing a set of nodes to the provided editor's node list.
 */
b3editor.ImportNodes = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.nodes = args.nodes;  // A list of objects each with the node to add and whether or not said node is an action.
    this.rollbackDataList = [];  // A list of rollback data objects from each addNode operation.
  }

  p.run = function() {
    // Add the nodes and get the rollback data from each operation.
    this.nodes.forEach(node => this.rollbackDataList.push(this.editor.addNode(node.nodeClass, node.isAction, true)));
  }

  p.undo = function() {
    // Remove the nodes.
    this.nodes.forEach(node => this.editor.removeNode(node.nodeClass.prototype.name, node.isAction));

    // Reverse the changes made by adding the nodes.
    this.rollbackDataList.forEach(rollbackData => {
      // Reset the data for each affected block.
      rollbackData.originalBlocks.forEach(originalBlock => {
        originalBlock.block.setNodeAttributes(originalBlock.originalData);
        originalBlock.block.redraw(false);
      });
    });
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