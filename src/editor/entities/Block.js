this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Block = b3.Class();
  var p = Block.prototype;

  p.initialize = function(node) {
    this.id             = b3.createUUID();
    
    this.displayObject  = new createjs.Container();
    this.inConnection   = null;
    this.outConnections = [];
    this.isSelected     = false;
    this.isRegistered   = true;
    this.isDragging     = false;
    this.dragOffsetX    = 0;
    this.dragOffsetX    = 0;
    
    this._width         = null;
    this._height        = null;
    this._shapeObject   = new createjs.Shape();
    this._shadowObject  = null;
    this._symbolObject  = null;

    this.loadNodeDef(node);

    this.applySettings(app.settings);
  }

  /**
   * Loads a node definition into the block. It is assumed that the name of the node being defined matches that of the 
   * current block. Based on this assumption, the title of the block will not be set if it is already defined. All
   * properties that are not defined or do not match in type are replaced. Any outputs that are not defined are also
   * replaced. If the block's new type is "action" or "module", it will lose all of its outConnections and return them.
   * It is up to the programmer to fully remove such connections from the editor.
   * 
   * @param {*} node the node definition to load
   * @returns the outConnections that were removed if the block became an action or module and had connections, 
   * null otherwise
   */
  p.loadNodeDef = function(node) {
    var dict = node.prototype;

    if (!dict) {
      dict = node;
    }

    this.node           = node;
    this.name           = dict.name;
    this.type       = dict.type;
    this.title          = this.title || dict.title || this.name;  // Will not replace the title if already defined.
    this.description    = dict.description || '';

    // If the properties are already defined...
    if (this.properties) {
      // For each property in the node definition...
      for (var key in dict.properties) {
        var property = dict.properties[key];

        // If the block does not have an equivalent property...
        if (!this.properties[key]) {
          // Set the block's property to be a deep copy of the node definition equivalent property.
          this.properties[key] = JSON.parse(JSON.stringify(property));
        }
      }
    } else {  // Otherwise...
      this.properties = b3editor.extend({}, dict.properties);
    }

    // This is what allows for dict.output to effectively define keys in this.output that are undefined.
    this.output         = b3editor.extend({}, dict.output, this.output || {});

    // If the new type of the block is "action" or "module" and the block has outConnections...
    if ((dict.type === "action" || dict.type === "module") && (this.outConnections.length > 0)) {
      var oldOutConnections = this.outConnections;

      // Delete all of them.
      this.outConnections = [];
    } else {  // Otherwise...
      var oldOutConnections = null;
    }

    return oldOutConnections;
  }

  p.applySettings = function(settings) {
    this.settings = settings || this.settings;
    this._shadowObject = new createjs.Shadow(
      this.settings.get('selection_color'), 0, 0, 5
    );

    this.redraw();
  }
  
  p.copy = function() {
    var block = new b3editor.Block(this.node);

    block.displayObject.x = this.displayObject.x;
    block.displayObject.y = this.displayObject.y;
    block._width          = this._width;
    block._height         = this._height;
    block.anchorXOffset   = this.anchorXOffset;
    block.type        = this.type;
    block.title           = this.title;
    block.description     = this.description;
    block.properties      = JSON.parse(JSON.stringify(this.properties));
    block.output          = this.output ? JSON.parse(JSON.stringify(this.output)) : null;
    block.isRegistered    = this.isRegistered;

    return block;
  }

  // Note: This operation is expensive to run. Use sparingly.
  p.redraw = function() {
    // Set variables
    var settings = this.settings;
    var name = this.name;
    var type = this.type.toLowerCase();
    var shape = app.editor.shapes[type];
    var symbol = app.editor.symbols[name] || b3editor.draw.textSymbol;

    this._width  = settings.get('block_'+type+'_width');
    this._height = settings.get('block_'+type+'_height');

    this.displayObject.removeAllChildren();

    // Draw symbol
    this._symbolObject = symbol(this, settings, this.isRegistered ? 'registered' : 'unregistered');

    // Draw shape
    this._shapeObject.graphics.clear();
    shape(this, settings, this.isRegistered ? 'registered' : 'unregistered');

    // Add to display
    this.displayObject.addChild(this._shapeObject);
    this.displayObject.addChild(this._symbolObject);

    //Redraw connections
    if (this.inConnection)
      this.inConnection.redraw();
    for (var i=0; i<this.outConnections.length; i++) {
      this.outConnections[i].redraw();
    }

    app.game.stage.update();
  }

  p.getTitle = function() {
    var s = this.title || this.name;
    var this_ = this;
    return s.replace(/(<\w+>)/g, function(match, key) {
      var attr = key.substring(1, key.length-1);
      if (this_.properties.hasOwnProperty(attr))
        return this_.properties[attr];
      else
        return match;
    });
  }

  /**
   * Returns the name, type, title, description, properties, and output of the block.
   * 
   * @returns the name, type, title, description, properties, and output of the block
   */
  p.getNodeAttributes = function() {
    return {
      name: this.name,
      type: this.type,
      title: this.title,
      description: this.description,
      properties: this.properties,
      output: this.output
    }
  }

  p.setNodeAttributes = function(attrs) {
    this.name = attrs.name;
    this.type = attrs.type;
    this.title = attrs.title;
    this.description = attrs.description;
    this.properties = JSON.parse(JSON.stringify(attrs.properties));  // Deep copy
    this.output = JSON.parse(JSON.stringify(attrs.output));  // Deep copy
  }

  // SELECTION ==============================================================
  p.select = function() {
    this.isSelected = true;
    this._shapeObject.shadow = this._shadowObject;
  }
  p.deselect = function() {
    this.isSelected = false;
    this._shapeObject.shadow = null;
  }
  // ========================================================================

  // CONNECTIONS ============================================================
  p.getOutNodeIds = function() {
    var nodes = [];
    for (var i=0; i<this.outConnections.length; i++) {
      nodes.push(this.outConnections[i].outBlock.id);
    }

    return nodes;
  }
  p.getOutNodeIdsByOrder = function() {
    var nodes = [];
    var conns = this.getOutConnectionsByOrder();
    for (var i=0; i<conns.length; i++) {
      nodes.push(conns[i].outBlock.id);
    }

    return nodes;
  }
  p.getOutConnectionsByOrder = function() {
    var conns = this.outConnections.slice(0);
    conns.sort(function(a, b) {
      return a.outBlock.displayObject.y - 
             b.outBlock.displayObject.y;
    })

    return conns;
  }

  p.addInConnection = function(connection) {
    this.inConnection = connection;
  }
  p.addOutConnection = function(connection) {
    this.outConnections.push(connection)
  }
  p.removeInConnection = function() {
    this.inConnection = null;
  }
  p.removeOutConnection = function(connection) {
    var index = this.outConnections.indexOf(connection);
    if (index > -1) {
      this.outConnections.splice(index, 1);
    }
  }
  // ========================================================================

  // HITTESTING =============================================================
  p.hitTest = function(x, y) {
    x = x - this.displayObject.x;
    y = y - this.displayObject.y;

    // return this.displayObject.hitTest(x, y);
    return this._shapeObject.hitTest(x, y);
  }
  p.isContainedIn = function(x1, y1, x2, y2) {
    if (x1 < this.displayObject.x-this._width/2 &&
        y1 < this.displayObject.y-this._height/2 &&
        x2 > this.displayObject.x+this._width/2 &&
        y2 > this.displayObject.y+this._height/2) {
      return true;
    }

    return false;
  }
  p.getLeftAnchorX = function() {
    return this.displayObject.x-this._width/2-this.settings.get('anchor_offset_x');
  }
  p.getRightAnchorX = function() {
    return this.displayObject.x+this._width/2+this.settings.get('anchor_offset_x');
  }

  // after hitTest returned true, verify if click was in block
  p.mouseInBlock = function(x, y) {
    return (Math.abs(x - this.displayObject.x) < this._width/2)
  }

  // after hitTest returned true, verify if click was in left anchor
  p.mouseInLeftAnchor = function(x, y) {
    var dx = x - this.displayObject.x;

    return (Math.abs(dx) > this._width/2 && dx < 0);
  }

  // after hitTest returned true, verify if click was in right anchor
  p.mouseInRightAnchor = function(x, y) {
    var dx = x - this.displayObject.x;

    return (Math.abs(dx) > this._width/2 && dx > 0);
  }
  // ========================================================================

  b3editor.Block = Block;
}());
