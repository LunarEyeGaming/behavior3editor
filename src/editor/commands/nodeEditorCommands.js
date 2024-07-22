this.b3editor = this.b3editor || {};

// Commands related to editing node definitions.

/**
 * A command representing adding the provided node to the provided editor's node list.
 */
b3editor.AddNode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.node = args.node;  // The node to add.
  }

  p.run = function() {
    // Add the node and update the blocks. Store the resulting rollback data.
    this.editor.addNode(this.node);
    this.rollbackData = this.editor.updateAllBlocks(this.node.prototype.name);
  }

  p.undo = function() {
    // Reverse the changes made by adding the node by resetting the data for each affected block
    this.rollbackData.forEach(originalBlock => {
      originalBlock.block.setNodeAttributes(originalBlock.oldData);
    });
    // Remove the node.
    this.editor.removeNode(this.node.prototype.name);
  }
})

/**
 * A command representing importing a set of nodes to the provided editor's node list.
 */
b3editor.ImportNodes = b3editor.defineCommand((Class, p) => {
  Class.modifiesSaveData = false;

  p.initialize = function(args) {
    this.editor = args.editor;

    this.nodes = args.nodes;  // A list of nodes to add.
    this.rollbackDataList = [];  // A list of rollback data objects from each addNode operation.
  }

  p.run = function() {
    this.rollbackDataList = [];

    // Add the nodes and get the rollback data from each instance of updating all blocks.
    this.nodes.forEach(node => {
      this.editor.addNode(node);
      this.rollbackDataList.push(this.editor.updateAllBlocks(node.prototype.name));
    });
  }

  p.undo = function() {
    // Reverse the changes made by adding the nodes.
    this.rollbackDataList.forEach(rollbackData => {
      // Reset the data for each affected block.
      rollbackData.forEach(originalBlock => {
        originalBlock.block.setNodeAttributes(originalBlock.originalData);
      });
    });

    // Remove the nodes.
    this.nodes.forEach(node => this.editor.removeNode(node.prototype.name));
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
      script: this.node.prototype.script,
      pathToTree: this.node.prototype.pathToTree
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
  }

  p.run = function() {
    this.editor.removeNode(this.nodeName);
  }

  p.undo = function() {
    this.editor.addNode(this.node);
    this.rollbackData = this.editor.updateAllBlocks(this.nodeName);
  }

  p.redo = function() {
    // Reverse the changes made by adding the node by resetting the data for each affected block
    this.rollbackData.forEach(originalBlock => {
      originalBlock.block.setNodeAttributes(originalBlock.oldData);
    });
    this.run();
  }
})

b3editor.TogglePatchMode = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.dirName = args.dirName;
    this.category = args.category;
  }

  p.run = function() {
    this.editor.setNodesPatchMode(this.dirName, this.category, !this.editor.getNodesPatchMode(this.dirName, this.category));
  }

  p.undo = function() {
    // May or may not cause problems in the near future.
    this.editor.setNodesPatchMode(this.dirName, this.category, !this.editor.getNodesPatchMode(this.dirName, this.category));
  }
})