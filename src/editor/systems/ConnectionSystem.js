this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var ConnectionSystem = b3.Class();
  var p = ConnectionSystem.prototype;

  p.initialize = function(params) {
    this.editor = params['editor'];
    this.canvas = params['canvas'];

    this.entity = null;

    this.canvas.stage.on('stagemousedown', this.onMouseDown, this);
    this.canvas.stage.on('stagemousemove', this.onMouseMove, this);
    this.canvas.stage.on('stagemouseup', this.onMouseUp, this);
  }

  p.onMouseDown = function(event) {
    if (event.nativeEvent.which !== 1) return;

    // if clicked on block
    var point = this.canvas.getLocalMousePosition();
    var x = point.x
    var y = point.y
    var block = this.editor.getBlockUnder(x, y);

    if (this.entity || !block) return;

    if (block.mouseInRightAnchor(x, y)) {
      // if user clicked at the outAnchor
      this.entity = this.editor.addConnection(block);

    } else if (block.mouseInLeftAnchor(x, y)) {
      // if user clicked at the inAnchor
      var connection = block.inConnection;
      if (!connection)
          return;

      block.removeInConnection();
      connection.removeOutBlock();

      this.entity = connection;
    }
  }

  p.onMouseMove = function(event) {
    // if no entity, return
    if (!this.entity) return;

    var point = this.canvas.getLocalMousePosition();
    var x = point.x
    var y = point.y

    // redraw
    this.entity.redraw(null, null, x, y);
  }

  p.onMouseUp = function(event) {
      if (event.nativeEvent.which !== 1) return;

      // if no entity, return
      if (!this.entity) return;

      var point = this.canvas.getLocalMousePosition();
      var x = point.x;
      var y = point.y;
      var block = this.editor.getBlockUnder(x, y);

      // if not entity or entity but no block
      if (!block || block === this.entity.inBlock || block.type === 'root') {
          // TODO: Make removing the connection a Command if the connection was already added.
          this.editor.removeConnection(this.entity);
      } else {
          var prevInConnection = undefined;
          var prevOutConnection = undefined;

          // if double parent on node
          if (block.inConnection) {
              prevInConnection = block.inConnection;
              this.editor.removeConnection(prevInConnection);
          }

          // if double children on root
          if ((this.entity.inBlock.type === 'root' || this.entity.inBlock.type === 'decorator') &&
                  this.entity.inBlock.outConnections.length > 1) {
              prevOutConnection = this.entity.inBlock.outConnections[0];
              this.editor.removeConnection(prevOutConnection);
          }

          this.editor.pushCommand('AddConnection', {
            connector: this.entity,
            inBlock: this.entity.inBlock,
            outBlock: block,
            prevInConnection,
            prevOutConnection
          })

          this.entity.redraw();
      }

      this.entity = null;
  }

  b3editor.ConnectionSystem = ConnectionSystem;
}());
