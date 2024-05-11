this.b3editor = this.b3editor || {};

// These are all the commands that are applicable to the tree editor itself (as opposed to anything to do with editing 
// node definitions for example).
// Due to most operations of comparison requiring reference equality, undo and redo methods MUST ensure that the 
// original element affected by the operation is kept and no identical copies of the original element are created.

/**
 * A command representing adding a node block to the behavior tree grid of the provided editor.
 */
b3editor.AddBlock = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.blockName = args.blockName;
    this.xPos = args.xPos;
    this.yPos = args.yPos;
  }

  p.run = function() {
    this.block = this.editor.addBlock(this.blockName, this.xPos, this.yPos);
  }

  p.undo = function() {
    // this.block is assumed to be valid.
    this.editor.removeBlock(this.block);

    // Make sure that the block disappears.
    this.editor.canvas.stage.update();
  }

  p.redo = function() {
    this.editor.registerBlock(this.block);

    this.editor.canvas.stage.update();
  }
})

/**
 * A command representing removing one or more node blocks from the behavior tree grid of the provided editor.
 */
b3editor.RemoveBlocks = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;
  
    this.blocks = args.blocks;
    // TODO: store the connections that were removed by this command.
  }

  p.run = function() {
    // Removes each block included.
    this.blocks.forEach(block => this.editor.removeBlock(block));

    this.editor.canvas.stage.update();
  }

  p.undo = function() {
    this.blocks.forEach(block => this.editor.registerBlock(block));

    this.editor.canvas.stage.update();
  }
})

/**
 * A command representing adding a connection.
 */
b3editor.AddConnection = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.connector = args.connector;
    this.inBlock = this.connector.inBlock;
    this.outBlock = args.outBlock;
    this.prevInConnection = args.prevInConnection;  // Entering connection removed due to double parent on node
    this.prevOutConnection = args.prevOutConnection;  // Exiting connection removed due to double child on decorator / root node
  }

  p.run = function() {
    // Adding the connection for the other end has already been triggered, so it's omitted here.
    this.connector.addOutBlock(this.outBlock);
    this.outBlock.addInConnection(this.connector);
  }

  p.undo = function() {
    this.editor.removeConnection(this.connector);

    // If prevInConnection is defined...
    if (this.prevInConnection) {
      this.editor.registerConnection(this.prevInConnection);
    }
    // If prevOutConnection is defined...
    if (this.prevOutConnection) {
      this.editor.registerConnection(this.prevOutConnection);
    }
  }

  p.redo = function() {
    this.editor.registerConnection(this.connector);

    // If prevInConnection is defined...
    if (this.prevInConnection) {
      this.editor.removeConnection(this.prevInConnection);
    }
    // If prevOutConnection is defined...
    if (this.prevOutConnection) {
      this.editor.removeConnection(this.prevOutConnection);
    }
  }
})

/**
 * A command representing removing a connection.
 */
b3editor.RemoveConnection = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.connector = args.connector;
    this.outBlock = args.outBlock;  // The outBlock that was disconnected.
  }

  p.run = function() {
    this.editor.removeConnection(this.connector);
  }

  p.undo = function() {
    this.connector.addOutBlock(this.outBlock);  // connector.outBlock was null upon first running the command.
    this.editor.registerConnection(this.connector);
  }
})

/**
 * A command repseenting moving a connection.
 */
b3editor.MoveConnection = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.connector = args.connector;
    this.prevOutBlock = args.prevOutBlock;  // The outBlock that was disconnected as a consequence of the move.
    this.outBlock = args.outBlock;  // The outBlock that was connected as a consequence of the move.
    this.removedConnector = args.removedConnector;  // The connector that was removed due to the move (if any).
  }

  p.run = function() {
    // Complete the moving of the connection.
    this.connector.addOutBlock(this.outBlock);
    this.outBlock.addInConnection(this.connector);
  }

  p.undo = function() {
    // Move the connector back to its original outBlock.
    this.connector.addOutBlock(this.prevOutBlock);
    // Set the original outBlock's inConnection to the connector.
    this.prevOutBlock.addInConnection(this.connector);
    // Set the other outBlock's inConnection to nothing.
    this.outBlock.removeInConnection();

    this.connector.redraw();  // Forces the connector to update its appearance.

    // Re-add the connection that was removed due to the movement if applicable.
    if (this.removedConnector) {
      this.editor.registerConnection(this.removedConnector);
    }
  }

  p.redo = function() {
    // Move the connector to the new outBlock.
    this.connector.addOutBlock(this.outBlock);
    // Set the new outBlock's inConnection to the connector.
    this.outBlock.addInConnection(this.connector);
    // Set the other outBlock's inConnection to nothing.
    this.prevOutBlock.removeInConnection();

    this.connector.redraw();  // Forces the connector to update its appearance.

    // Redo the removal of the removed connection.
    if (this.removedConnector) {
      this.editor.removeConnection(this.removedConnector);
    }
  }
})

/**
 * Unfinished.
 */
// b3editor.AddNodeProperty = b3editor.defineCommand((_, p) => {
//   p.initialize = function(args) {
//     this.editor = args.editor;

//     this.type = args.type;
//     this.name = args.name;
//     this.value = args.value;
//   }

//   p.run = function() {

//   }
// })