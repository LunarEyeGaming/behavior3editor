this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var DragSystem = b3.Class();
  var p = DragSystem.prototype;

  p.initialize = function(params) {
    this.editor = params['editor'];
    this.canvas = params['canvas'];

    this.isDragging = false;
    this.startDragPositions = null;

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

  p.onMouseMove = function(event) {
    if (!this.isDragging) return;

    var point = this.canvas.getLocalMousePosition();
    var x = point.x
    var y = point.y

    // // move entity
    for (var i=0; i<this.editor.selectedBlocks.length; i++) {
      var block = this.editor.selectedBlocks[i];

      var dx = x - block.dragOffsetX;
      var dy = y - block.dragOffsetY;

      block.displayObject.x = dx - dx%this.editor.settings.get('snap_x');
      block.displayObject.y = dy - dy%this.editor.settings.get('snap_y');

      // redraw connections linked to the entity
      block.redraw();
    }
  }

  p.onMouseUp = function(event) {
    if (event.nativeEvent.which !== 1) return;
    if (!this.isDragging) return;

    var movements = [];
    var blocksWereMoved = false;
    this.isDragging = false;

    // For each selected block and corresponding starting position...
    for (var i=0; i<this.editor.selectedBlocks.length; i++) {
      var block = this.editor.selectedBlocks[i];
      var startPos = this.startDragPositions[i].startPos;

      block.isDragging = false;  // Mark the block as no longer being dragged.

      // If the starting position does not match the ending position...
      if (startPos.x != block.displayObject.x || startPos.y != block.displayObject.y) {
        blocksWereMoved = true;  // Say that at least one block has been moved.

        // Add the movement to the list.
        movements.push({
          block,
          startPos,
          endPos: {x: block.displayObject.x, y: block.displayObject.y}
        });
      }
    }

    // If at least one block has been moved...
    if (blocksWereMoved) {
      // Add the MoveBlocks command.
      this.editor.pushCommandTree('MoveBlocks', {movements});
    }
  }
    
  b3editor.DragSystem = DragSystem;
}());
