this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var DragSystem = b3.Class();
  var p = DragSystem.prototype;

  p.initialize = function(params) {
    this.editor = params['editor'];
    this.canvas = params['canvas'];

    this.hasDraggedEnough = false;  // Whether or not the user has dragged enough for the blocks to start moving.
    this.isDragging = false;  // Whether or not the user is currently dragging.
    this.startDragPositions = null;  // Starting positions of blocks
    this.startDragCenter = null;  // Starting position of cursor

    this.canvas.stage.on('stagemousedown', this.onMouseDown, this);
    this.canvas.stage.on('stagemousemove', this.onMouseMove, this);
    this.canvas.stage.on('stagemouseup', this.onMouseUp, this);
  }

  p.onMouseDown = function(event) {
    if (event.nativeEvent.which !== 1) return;

    // ctrl is for selection
    if (keyboard.ctrl) return;

    // if is already dragging 
    if (this.isDragging) return;
    
    var point = this.canvas.getLocalMousePosition();
    var x = point.x
    var y = point.y
    var block = this.editor.getBlockUnder(x, y);

    // if mouse not on block
    if (!block) return;

    // if no block selected
    if (!block.isSelected) return;

    // if mouse in anchor
    if (!block.mouseInBlock(x, y)) return;

    // start dragging
    this.isDragging = true;
    this.startDragPositions = [];
    this.startDragCenter = {x, y};

    for (var i=0; i<this.editor.selectedBlocks.length; i++) {
      var block = this.editor.selectedBlocks[i];
      block.isDragging = true;
      block.dragOffsetX = x - block.displayObject.x;
      block.dragOffsetY = y - block.displayObject.y;

      // Add to startDragPositions data on the block that will be moved.
      this.startDragPositions.push({
        block,
        startPos: {x: block.displayObject.x, y: block.displayObject.y}
      });
    }
  }

  // Called when the user moves the mouse. This is regardless of whether or not they are holding down a mouse button.
  p.onMouseMove = function(event) {
    if (!this.isDragging) return;

    var point = this.canvas.getLocalMousePosition();
    var x = point.x;
    var y = point.y;

    // If the user has not dragged enough...
    if (!this.hasDraggedEnough) {
      // Check if the distance on either axis exceeds the snap threshold and set this.hasDraggedEnough to the result.
      var dragDistance = {x: Math.abs(x - this.startDragCenter.x), y: Math.abs(y - this.startDragCenter.y)};
      this.hasDraggedEnough = dragDistance.x > this.editor.settings.get("snap_x")
        || dragDistance.y > this.editor.settings.get("snap_y");
    } else {
      // For each selected block...
      for (var i=0; i<this.editor.selectedBlocks.length; i++) {
        // Move the selected block.
        var block = this.editor.selectedBlocks[i];

        var dx = x - block.dragOffsetX;
        var dy = y - block.dragOffsetY;

        block.displayObject.x = dx - dx%this.editor.settings.get('snap_x');
        block.displayObject.y = dy - dy%this.editor.settings.get('snap_y');

        // Redraw connections linked to the selected block
        block.redrawConnections();
      }

      // Make changes go into effect.
      this.canvas.stage.update();
    }
  }

  p.onMouseUp = function(event) {
    if (event.nativeEvent.which !== 1) return;
    if (!this.isDragging) return;

    this.isDragging = false;

    if (!this.hasDraggedEnough) return;  // Do nothing if blocks have not been dragged enough.

    this.hasDraggedEnough = false;

    var movements = [];

    // For each selected block and corresponding starting position...
    for (var i=0; i<this.editor.selectedBlocks.length; i++) {
      var block = this.editor.selectedBlocks[i];
      var startPos = this.startDragPositions[i].startPos;

      block.isDragging = false;  // Mark the block as no longer being dragged.

      // If the starting position does not match the ending position...
      if (startPos.x != block.displayObject.x || startPos.y != block.displayObject.y) {
        // Add the movement to the list.
        movements.push({
          block,
          startPos,
          endPos: {x: block.displayObject.x, y: block.displayObject.y}
        });
      }
    }

    // Add the MoveBlocks command.
    this.editor.pushCommandTree('MoveBlocks', {movements});
  }
    
  b3editor.DragSystem = DragSystem;
}());
