this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   *  Organizer
  **/
  var Organizer = b3.Class();
  var p = Organizer.prototype;

  p.initialize = function() {
    this.depth            = 0;
    this.leafCont         = 0;
    this.horizontalMargin = 64;
    this.verticalSpacing  = 64;
    this.orderByIndex     = false;
    this.connections      = []; // to redraw connections
    this.blocks           = []; // to reposition blocks
  }

  p.__step = function(block) {
    this.blocks.push(block);

    // leaf
    if (block.outConnections.length == 0) {
      this.leafCont++;

      // leaf nodes have the position accord. to the depth and leaf cont.
      // Nudge to the left so that the left side of the current block aligns with that of the widest block.
      var x = this.hPositions[this.depth] + (block._width / 2 - this.halfWidthList[this.depth]);
      var y = this.leafCont*this.verticalSpacing;
    }

    // internal node
    else {
      // internal nodes have the position acord. to the depth and the
      //    mean position of its children
      var ySum = 0;

      if (this.orderByIndex) {
        var conns = block.outConnections;
      } else {
        // get connections ordered by y position
        var conns = block.getOutConnectionsByOrder();
      }

      for (var i=0; i<conns.length; i++) {
        this.depth++;
        this.connections.push(conns[i]);
        ySum += this.__step(conns[i].outBlock);
        this.depth--;
      }

      // Nudge to the left so that the left side of the current block aligns with that of the widest block.
      var x = this.hPositions[this.depth] + (block._width / 2 - this.halfWidthList[this.depth]);
      var y = ySum/block.outConnections.length;
    }

    block.displayObject.x = x;
    block.displayObject.y = y;

    return y;
  }

  /**
   * Sets the list of horizontal positions `hPositions` to use for each level in the tree with root `root` based on the
   * widest block in that level as well as the half-widths for each level.
   * 
   * @param {b3editor.Block} root the root of the tree to use
   */
  p.__setHPositionInfo = function(root) {
    // Breadth-first traversal that sets the width of each level in the tree starting at the root by finding the width 
    // of the widest block at each depth.
    var widthLevelList = [];  // Use depth as the index.
    var depth = 0;
    var queue = [{block: root, depth}];  // Initially contains `root`

    // While the queue is not empty...
    while (queue.length > 0) {
      // Get a leveled block from the queue.
      var [leveledBlock] = queue.splice(0, 1);

      // Update depth
      depth = leveledBlock.depth;

      // If the width of the widest block at the depth of the current block is undefined or is less than the width of
      // the current block...
      if (widthLevelList[depth] == undefined || widthLevelList[depth] < leveledBlock.block._width) {
        // Set the width of the widest block at the depth of the current block to be the current block's width.
        widthLevelList[depth] = leveledBlock.block._width;
      }

      // For each child of the current block...
      leveledBlock.block.outConnections.forEach(connection => {
        // Add the child to the queue.
        queue.push({block: connection.outBlock, depth: depth + 1});
      });
    }

    // Set the horizontal positions and half widths
    this.hPositions = [0];
    this.halfWidthList = [0];

    // For each width in widthLevelList (enumerated)...
    for (var i = 1; i < widthLevelList.length; i++) {
      // Calculate the horizontal position for level i and add it to the list of horizontal positions.
      this.hPositions[i] = this.hPositions[i - 1] + widthLevelList[i] / 2 + widthLevelList[i - 1] / 2 + this.horizontalMargin;
      // Calculate the half width for level i and add it to the list.
      this.halfWidthList[i] = widthLevelList[i] / 2;
    }
  }

  p.organize = function(root, orderByIndex) {
    if (!root) return;

    this.depth        = 0;
    this.leafCont     = 0;
    this.connections  = [];
    this.blocks       = [];
    this.orderByIndex = orderByIndex;

    var offsetX = root.displayObject.x;
    var offsetY = root.displayObject.y;

    var root = root;
    this.__setHPositionInfo(root);
    this.__step(root);

    offsetX -= root.displayObject.x;
    offsetY -= root.displayObject.y;

    for (var i=0; i<this.blocks.length; i++) {
      this.blocks[i].displayObject.x += offsetX;
      this.blocks[i].displayObject.y += offsetY;
    }

    for (var i=0; i<this.connections.length; i++) {
      this.connections[i].redraw();
    }

    return this.connections;
  }

  b3editor.Organizer = Organizer;
}());
