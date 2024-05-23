this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Block = b3.Class();
  var p = Block.prototype;

  /**
   * Initializes the Block, optionally rendering the block on initialization.
   * 
   * @param {*} node the node definition to use in the Block's initialization
   * @param {boolean} shouldRender (optional) whether or not the Block should automatically be rendered. true by default
   */
  p.initialize = function(args) {
    var node = args.node;
    var shouldRender = args.shouldRender;

    shouldRender = shouldRender !== undefined ? shouldRender : true;

    this.id              = b3.createUUID();
    
    this.displayObject   = new createjs.Container();
    this.inConnection    = null;
    this.outConnections  = [];
    this.isSelected      = false;
    this.isRegistered    = true;
    this.isInvalid       = false;
    this.isDragging      = false;
    this.dragOffsetX     = 0;
    this.dragOffsetX     = 0;
    
    this._width          = null;
    this._height         = null;
    this._shapeObject    = new createjs.Shape();
    this._invalidOverlay = new createjs.Shape();
    this._shadowObject   = null;
    this._symbolObject   = null;

    this.loadNodeDef(node);

    this.applySettings(app.settings, shouldRender);
  }

  /**
   * Loads a node definition into the block. It is assumed that the name of the node being defined matches that of the 
   * current block. Based on this assumption, the title of the block will not be set if it is already defined. All
   * properties that are not defined or do not match in type are replaced. Any outputs that are not defined are also
   * replaced. 
   * 
   * If the block's new type is "action" or "module" and it has any out connections, an error is thrown. The programmer
   * should not catch this error and should instead check if the type will change.
   * 
   * @param {b3editor.Composite | b3editor.Action | b3editor.Decorator | b3editor.Module} node the node definition to load
   * @throws EvalError if the new type of the block is "action" or "module" and the block has out connections.
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
    if ((dict.type === "action" || dict.type === "module") && (this.outConnections.length > 0))
      throw new EvalError("Cannot load node definition. Type change results in loss of connections.");
  }

  /**
   * Applies the given `settings` to the current block, optionally redrawing it afterwards.
   * 
   * @param {*} settings the settings to apply
   * @param {boolean} shouldRedraw (optional) whether or not the block should be redrawn. true by default.
   */
  p.applySettings = function(settings, shouldRedraw) {
    shouldRedraw = shouldRedraw !== undefined ? shouldRedraw : true;

    this.settings = settings || this.settings;
    this._shadowObject = new createjs.Shadow(
      this.settings.get('selection_color'), 0, 0, 5
    );

    if (shouldRedraw)
      this.redraw(false);
  }
  
  p.copy = function() {
    var block = new b3editor.Block({node: this.node});

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
  // redrawConnections specifies whether or not the connections should be redrawn too. Defaults to true.
  p.redraw = function(redrawConnections) {
    redrawConnections = redrawConnections !== undefined ? redrawConnections : true;

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

    // Draw invalid overlay (if the block is invalid).
    this._invalidOverlay.graphics.clear();
    if (this.isInvalid)
      b3editor.draw.invalidOverlay(this, settings);

    // Add to display
    this.displayObject.addChild(this._shapeObject);
    this.displayObject.addChild(this._symbolObject);
    this.displayObject.addChild(this._invalidOverlay);

    // If the block should redraw connections...
    if (redrawConnections) {
      this.redrawConnections();
    }

    app.game.stage.update();
  }

  // Redraws all connections associated with the block.
  p.redrawConnections = function() {
    if (this.inConnection)
      this.inConnection.redraw();
    for (var i=0; i<this.outConnections.length; i++) {
      this.outConnections[i].redraw();
    }
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

  /**
   * Sets the name, type, title, description, properties, and output of the block using the provided `attrs`.
   * 
   * @param {object} attrs the attributes to set
   */
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
