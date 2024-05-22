this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var ConnectionSystem = b3.Class();
  var p = ConnectionSystem.prototype;

  p.initialize = function(params) {
    this.editor = params['editor'];
    this.canvas = params['canvas'];

    this.entity = null;
    this.prevOutBlock = null;  // The outBlock that was affected by a disconnection.

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
      this.entity = this.editor.makeAndAddConnection(block);

      // Set the prevOutBlock attribute to null.
      this.prevOutBlock = null;

    } else if (block.mouseInLeftAnchor(x, y)) {
      // if user clicked at the inAnchor
      var connection = block.inConnection;
      if (!connection)
          return;

      // Set the prevOutBlock attribute to note that an outBlock had been disconnected.
      this.prevOutBlock = block;

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
          // If the connection previously had an outBlock (and implicitly is now disconnected)...
          if (this.prevOutBlock) {
            // Count this as an action as we are deleting a connection.
            this.editor.pushCommandTree('RemoveConnection', {
              connector: this.entity,
              outBlock: this.prevOutBlock
            });
          } else {  // Otherwise...
            // Remove the connection without counting it as an action.
            this.editor.removeConnection(this.entity);
          }
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

          // If the connection previously had an outBlock (and implicitly is now disconnected)...
          if (this.prevOutBlock) {
            // Count this as moving a connection.
            this.editor.pushCommandTree('MoveConnection', {
              connector: this.entity,
              prevOutBlock: this.prevOutBlock,
              outBlock: block,
              removedConnector: prevInConnection
            });
          } else {  // Otherwise...
            // Count this as adding a connection.
            this.editor.pushCommandTree('AddConnection', {
              connector: this.entity,
              inBlock: this.entity.inBlock,
              outBlock: block,
              prevInConnection,
              prevOutConnection
            });
          }
          

          this.entity.redraw();
      }

      this.entity = null;
  }

  b3editor.ConnectionSystem = ConnectionSystem;
}());
