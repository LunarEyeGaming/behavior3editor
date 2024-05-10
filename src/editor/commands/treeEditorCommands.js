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