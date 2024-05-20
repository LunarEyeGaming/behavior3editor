this.b3editor = this.b3editor || {};

// These are all the commands that are applicable to the tree editor itself (as opposed to anything to do with editing 
// node definitions for example).
// Due to most operations of comparison requiring reference equality, undo and redo methods MUST ensure that the 
// original element affected by the operation is kept and no identical copies of the original element are created.

// =====================================================================================================================
// BLOCK COMMANDS
// =====================================================================================================================
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
    this.block = this.editor.makeAndAddBlock(this.blockName, this.xPos, this.yPos);
  }

  p.undo = function() {
    // this.block is assumed to be valid.
    this.editor.removeBlock(this.block);

    // Make sure that the block disappears.
    this.editor.canvas.stage.update();
  }

  p.redo = function() {
    // This forces a redraw of the block if something about the corresponding node definition changed.
    this.editor.addAndUpdateBlock(this.block);

    this.editor.canvas.stage.update();
  }
})

/**
 * A command representing editing a node block in the behavior tree grid of the provided editor.
 */
b3editor.EditBlock = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.block = args.block;  // The block to modify
    this.oldChanges = this.block.getNodeAttributes();  // The original values of the fields.
    this.changes = args.changes;  // The new values that the fields of the block will take on
  }

  p.run = function() {
    this.editor.editBlock(this.block, this.changes);
  }

  p.undo = function() {
    this.editor.editBlock(this.block, this.oldChanges);
  }
})

/**
 * A command representing removing one or more node blocks from the behavior tree grid of the provided editor.
 */
b3editor.RemoveBlocks = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;
  
    this.blocks = args.blocks;
    // Store the connections that will be removed.
    this.connections = [];
    this.blocks.forEach(block => {
      // If the inConnection is defined and is not in the list of connections...
      if (block.inConnection && this.connections.indexOf(block.inConnection) == -1) {
        this.connections.push(block.inConnection);  // Add it.
      }

      // For each outConnection...
      block.outConnections.forEach(connection => {
        // If the connection is not in the list of connections...
        if (this.connections.indexOf(connection) == -1) {
          this.connections.push(connection);  // Add it.
        }
      })
    })
  }

  p.run = function() {
    // Removes each block included.
    this.blocks.forEach(block => this.editor.removeBlock(block));

    this.editor.canvas.stage.update();
  }

  p.undo = function() {
    // This forces a redraw of the blocks if something about the corresponding node definitions changed.
    this.blocks.forEach(block => this.editor.addAndUpdateBlock(block));

    // The connections will have to be added back manually.
    this.connections.forEach(connection => this.editor.addConnection(connection));

    this.editor.canvas.stage.update();
  }
})

/**
 * A command representing moving some blocks.
 * * movements: A list of objects each containing the following entries:
 *   * block: the block that was moved
 *   * startPos: the starting position of the block (as 2D coordinates, where x is the x coordinate and y is the y 
 *     coordinate)
 *   * endPos: the ending position of the block (as 2D coordinates, where x is the x coordinate and y is the y 
 *     coordinate)
 */
b3editor.MoveBlocks = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.movements = args.movements
  }

  p.run = function() {
    // This is supposed to do nothing.
  }

  p.undo = function() {
    // For each movement...
    this.movements.forEach(movement => {
      // Move the block back to its original position.
      movement.block.displayObject.x = movement.startPos.x;
      movement.block.displayObject.y = movement.startPos.y;

      // Redraw the block and its connections.
      movement.block.redraw();
    })

    // Update the canvas to reflect the change.
    this.editor.canvas.stage.update();
  }

  p.redo = function() {
    // For each movement...
    this.movements.forEach(movement => {
      // Move the block back to its new position.
      movement.block.displayObject.x = movement.endPos.x;
      movement.block.displayObject.y = movement.endPos.y;

      // Redraw the block and its connections.
      movement.block.redraw();
    })
  }
})

// =====================================================================================================================
// CONNECTION COMMANDS
// =====================================================================================================================
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
    this.prevOutConnection = args.prevOutConnection;  // Exiting connection removed due to double child on decorator / 
    // root node
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
      this.editor.addConnection(this.prevInConnection);
    }
    // If prevOutConnection is defined...
    if (this.prevOutConnection) {
      this.editor.addConnection(this.prevOutConnection);
    }
  }

  p.redo = function() {
    this.editor.addConnection(this.connector);

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
    this.connector.addOutBlock(this.outBlock);  // connector.outBlock was null upon first running the command because
    // the user has already dragged the connector out of the block.
    this.editor.addConnection(this.connector);
  }
})

/**
 * A command representing removing multiple connections.
 */
b3editor.RemoveConnections = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.connections = args.connections;
  }

  p.run = function() {
    // Go through each connection and remove it.
    this.connections.forEach(connection => this.editor.removeConnection(connection));
  }

  p.undo = function() {
    // Go through each connection and add it back.
    this.connections.forEach(connection => this.editor.addConnection(connection));
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
      this.editor.addConnection(this.removedConnector);
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

// =====================================================================================================================
// OTHER COMMANDS
// =====================================================================================================================

/**
 * A command representing pasting some blocks and corresponding connections.
 */
b3editor.Paste = b3editor.defineCommand((_, p) => {
  p.initialize = function(args) {
    this.editor = args.editor;

    this.blocks = args.blocks;
    this.connections = args.connections;
  }

  p.run = function() {
    // Snapping the blocks needs to occur only once, so that's why we have the redo method not do that (and call redo in
    // the run method to do the rest of the work).
    this.redo();

    this.editor.snap(this.blocks);
  }

  p.undo = function() {
    // Hides the blocks from the editor (which also hides the connections automatically).
    this.blocks.forEach(block => this.editor.removeBlock(block));

    // Make sure that the blocks disappear.
    this.editor.canvas.stage.update();
  }

  p.redo = function() {
    // This forces a redraw of the blocks if something about the corresponding node definitions changed.
    this.blocks.forEach(block => this.editor.addAndUpdateBlock(block));
    this.connections.forEach(connection => this.editor.addConnection(connection));

    // Make sure that the blocks reappear.
    this.editor.canvas.stage.update();
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