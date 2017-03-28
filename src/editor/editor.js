this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Editor = b3.Class(createjs.EventDispatcher);

  var p = Editor.prototype;

  p.initialize = function() {
    this.settings = new b3editor.SettingsManager();
    this.loadSettings();
    this.saveSettings(); // creates new settings file if it doesn't exist

    this.logger = new b3editor.Logger();
    var editor = this;
    this.logger.onWarning = function(message) {
      editor.trigger('notification', "Warning", {
        level: 'warn',
        message: message
      });
    }
    this.logger.onError = function(message) {
      editor.trigger('notification', "Error", {
        level: 'error',
        message: message
      });
    }

    this.canvas = new b3editor.Game(this.settings);
    app.editor = this;
    app.settings= this.settings;
    app.game = this.canvas;

    // MODELS
    this.project = null;
    this.tree = null
    this.trees = [];

    // TREE
    this.blocks           = [];
    this.connections      = [];
    this.selectedBlocks   = [];

    // PROJECT
    this.resetNodes();
    this.warnedNodes      = new Set();
    this.clipboard        = [];

    // WHOLE
    this.symbols          = {};
    this.shapes           = {};
    this.systems          = [];

    // TEMP
    this.selectionBox     = new b3editor.SelectionBox();

    this.organizer   = new b3editor.Organizer();

    // register system
    var params = {editor:this, canvas:this.canvas};
    this.registerSystem(new b3editor.CameraSystem(params));
    this.registerSystem(new b3editor.SelectionSystem(params));
    this.registerSystem(new b3editor.DragSystem(params));
    this.registerSystem(new b3editor.ConnectionSystem(params));

    // register shape
    this.registerShape('root',      b3editor.draw.rootShape);
    this.registerShape('composite', b3editor.draw.compositeShape);
    this.registerShape('decorator', b3editor.draw.decoratorShape);
    this.registerShape('module', b3editor.draw.conditionShape);
    this.registerShape('action',    b3editor.draw.actionShape);

    // register symbol
    this.registerSymbol('Root',         b3editor.draw.rootSymbol);
    this.registerSymbol('sequence',  b3editor.draw.memsequenceSymbol);
    this.registerSymbol('dynamic',     b3editor.draw.prioritySymbol);
    this.registerSymbol('selector',  b3editor.draw.memprioritySymbol);

    // register root node
    this.registerNode(b3editor.Root);

    this.canvas.layerOverlay.addChild(this.selectionBox.displayObject);

    this.addTree();
    this.center();

    this.canvas.stage.update();

    var lastProject = this.settings.get("last_project")
    if (lastProject) {
      var project = fs.readFileSync(lastProject);
      this.loadProject(b3editor.Project.load(lastProject, project));
    }
  };

  // INTERNAL =================================================================
  p.trigger = function(name, target, variables) {
    variables = variables || {};

    var event = new createjs.Event(name)
    event._target = target;
    for (key in variables) {
      event[key] = variables[key];
    }
    this.dispatchEvent(event);
  }
  p.registerNode = function(node) {
    // TODO: raise error if node is invalid
    var name = node.prototype.name;
    this.nodes[name] = node;

    var category = node.prototype.category
    if (category) {
      this.categories[category] = true;
    }
  }

  p.resetNodes = function() {
    this.nodes = {};
    this.categories = {};
    this.registerNode(b3editor.Root);
  }

  p.loadSettings = function() {
    this.settings.load(b3editor.OPTIONS);
    this.settings.load(b3editor.THEME_DARK);
    this.settings.load(b3editor.SHORTCUTS);
    if (fs.existsSync("../settings.json")) {
      var settings = JSON.parse(fs.readFileSync("../settings.json"));
      this.settings.load(settings)
    }
  }

  p.saveSettings = function() {
    var settings = JSON.stringify(this.settings.all(), null, 2);
    fs.writeFileSync("../settings.json", settings);
  }

  p.registerSymbol = function(type, symbol) {
    if (!symbol) {
      symbol = type;
    }
    this.symbols[type] = symbol;
  }
  p.registerShape = function(name, shape) {
    this.shapes[name] = shape;
  }
  p.registerSystem = function(system, priority) {
    if (priority) {
      this.systems.splice(0, 0, system);
    } else {
      this.systems.push(system);
    }
  }
  p.getRoot = function() {
    for (var i=0; i<this.blocks.length; i++) {
      if (this.blocks[i].type === 'root') {
        return this.blocks[i];
      }
    }
  }
  p.getBlockUnder = function(x, y) {
    if (!x || !y) {
      var point = this.canvas.getLocalMousePosition();
      x = point.x;
      y = point.y;
    }

    // Get block under the mouse
    for (var i=this.blocks.length-1; i>=0; i--) {
      var block = this.blocks[i];

      // Verify collision
      if (block.hitTest(x, y)) {
        return block;
      }
    }
  }
  p.getBlockById = function(id) {
    for (var i=0; i<this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.id == id) {
        return block;
      }
    }
  }
  p.applySettings = function(settings) {
    var settings = settings || this.settings;
    this.canvas.applySettings(settings);
    for (var i=0; i<this.blocks.length; i++) {
      this.blocks[i].applySettings(settings);
    }
    for (var i=0; i<this.connections.length; i++) {
      this.connections[i].applySettings(settings);
    }
  }
  p.importBlock = function(node, parent) {
    if (this.nodes[node.name] == undefined) {
      var nodeCopy = JSON.parse(JSON.stringify(node));
      if (nodeCopy.child) delete nodeCopy.child;
      if (nodeCopy.children) delete nodeCopy.children;
      this.logger.error("Node \"" + node.name + "\" not registered. Loaded with config: \n" + JSON.stringify(nodeCopy, null, 2));
      return;
    }

    var block = this.addBlock(node.name, 0, 0);
    block.id = b3.createUUID();
    block.title = node.title;
    block.description = node.description;
    block.properties = node.parameters || {};

    if (node.type == 'action')
      block.output = node.output || {};

    // Import properties
    for (var key in block.properties) {
      if (block.node.prototype.properties[key] === undefined) {
        this.logger.warn("Deleting property not specified in prototype from \""+node.name+"\": " + key);
        delete block.properties[key];
      }
    }

    // Import output types
    if (block.type == 'action') {
      for (var key in block.output) {
        if (block.node.prototype.output[key] === undefined) {
          this.logger.warn("Deleting output not specified in prototype from \""+node.name+"\": " + key);
          delete block.output[key];
        }
      }
    }

    if (parent) {
      var outBlock = this.getBlockById(parent);
      this.addConnection(outBlock, block);
    }

    var error = false;
    if (node.children) {
      for (var i=0; i<node.children.length; i++) {
        var parent = error ? null : block.id;
        if (!this.importBlock(node.children[i], parent)) {
          error = true;
        }
      }
    }
    if (node.child) {
      var parent = error ? null : block.id;
      if (!this.importBlock(node.child, parent)) {
        error = true;
      }
    }

    if (error) {
      return;
    }

    block.redraw();

    return block
  }
  p.importFromJSON = function(json) {
    this.reset();

    var data = JSON.parse(json);
    this.logger.info("Import tree "+data.name);
    var dataRoot = this.importBlock(data.root);
    if (!dataRoot) {
      this.logger.error("Failed to import tree "+data.name);
      this.reset();
      return false;
    }

    var root = this.getRoot();
    root.title = data.name;
    root.properties = data.parameters || {};
    this.addConnection(root, dataRoot);

    this.organize(true);
    return true;
  }
  p.openTreeFile = function(filename) {
    for (var i=0; i<this.trees.length; i++) {
      var tree = this.trees[i];
      if (tree.path == filename) {
        this.selectTree(tree.id);
        return;
      }
    }

    this.logger.info("Open behavior from " + filename);
    var tree = this.addTree();
    tree.path = filename;

    var editor = this;
    var data = fs.readFileSync(filename);
    editor.importFromJSON(data);
  }
  p.exportBlock = function(block, scripts) {
    var data = {};

    data.title = block.title;
    data.type = block.type;
    data.name = block.name;
    data.parameters = {};
    var parameterKeys = Object.keys(block.properties)
    for (var i=0; i<parameterKeys.length; i++) {
      var key = parameterKeys[i];
      if (block.properties[key] != null)
        data.parameters[key] = block.properties[key];
    }

    var script = block.node.prototype.script;
    if (script && script != '') {
      if(scripts.indexOf(script) == -1) {
        scripts.push(script);
      }
    }

    if (block.type == 'action' && Object.keys(block.output).length > 0)
      data.output = block.output;

    var children = block.getOutNodeIdsByOrder();
    if (children.length > 0) {
      if (block.type == "composite") {
        data.children = [];
        for (var i=0; i<children.length; i++) {
          data.children[i] = this.exportBlock(this.getBlockById(children[i]), scripts);
        }
      } else if (block.type == "decorator") {
        data.child = this.exportBlock(this.getBlockById(children[0]), scripts);
      }
    }

    return data;
  }
  p.exportToJSON = function() {
    var root = this.getRoot();
    var data = {};

    // Tree data
    data.name = root.title;
    data.description = root.description;
    data.scripts = [];
    data.parameters = {};
    for (var key in root.properties) {
      if (key != "scripts")
        data.parameters[key] = root.properties[key];
    }

    var rootBlock = root.getOutNodeIds()[0]
    if (rootBlock) {
      data.root = this.exportBlock(this.getBlockById(rootBlock), data.scripts);

      return JSON.stringify(data, null, 2);
    } else {
      return "{}";
    }
  }
  p.getScripts = function() {

  }
  p.writeTreeFile = function() {
    var json = this.exportToJSON();
    var path = this.tree.path;
    var editor = this;

    if (path != "") {
      fs.writeFile(path, json, function(err){
        if (err) throw err;

        this.logger.info("Saved tree "+name)
        editor.trigger('notification', name, {
          level: 'success',
          message: 'Saved'
        });
      });
    }
  }
  p.saveTree = function() {
    var path = this.tree.path;

    if (path == "") {
      var editor = this;
      dialog.showSaveDialog({
        title: "Save Behavior File",
        filters : [
          { name: "Behavior", extensions: ['behavior']},
          { name: "All files", extensions: ['*']}
        ]
      }, function(filename) {
        editor.tree.path = filename;

        editor.writeTreeFile();
      });
    } else {
      this.writeTreeFile();
    }
  }
  p.loadProject = function(project) {
    this.settings.set("last_project", project.fileName);
    this.saveSettings();

    this.logger.info("Loaded project from " + project.fileName);
    this.project = project;

    this.resetNodes();
    project.findNodes().forEach(file => {
      this.logger.info("Import nodes from " + path.relative(project.fileName, file))
      var json = fs.readFileSync(file);
      this.importNodes(json);
    });

    this.reset();

    // project.findTrees().forEach(file => {
    //   this.openTreeFile(file);
    // });

    this.logger.info("Successfully loaded project")
  }
  p.exportNodeCategory = function(category) {
    var data = {};
    for (var name in this.nodes) {
      var node = this.nodes[name];
      var nodeCategory = node.prototype.category || node.prototype.type
      if (nodeCategory == category) {
        if (node.prototype.type != "root") {
          data[name] = {};
          data[name].type = node.prototype.type;
          data[name].name = node.prototype.name;
          data[name].title = node.prototype.title;
          if (node.prototype.properties)
            data[name].properties = JSON.parse(JSON.stringify(node.prototype.properties));

          if (node.prototype.type == "action") {
            if (node.prototype.category)
              data[name].category = node.prototype.category;
            if (node.prototype.script)
              data[name].script = node.prototype.script;
            if (node.prototype.output)
              data[name].output = JSON.parse(JSON.stringify(node.prototype.output));
          }
        }
      }
    }
    return JSON.stringify(data, null, 2)
  }
  p.exportNodes = function() {
    var nodes = {}
    nodes.composite = this.exportNodeCategory("composite")
    nodes.decorator = this.exportNodeCategory("decorator")
    nodes.action = this.exportNodeCategory("action")
    nodes.module = this.exportNodeCategory("module")
    for (var category in this.categories) {
      nodes[category] = this.exportNodeCategory(category);
    }
    return nodes;
  }
  p.importNodes = function(json) {
    var nodes = JSON.parse(json);
    for (var name in nodes) {
      var node = nodes[name];

      this.addNode(node);
    }
  }
  p.addNode = function(node) {
    if (this.nodes[node.name]) {
      this.logger.error('Node named "'+node.name+'" already registered.')
      return;
    }

    var classes = {
      'composite' : b3editor.Composite,
      'decorator' : b3editor.Decorator,
      'action' : b3editor.Action,
      'module' : b3editor.Module
    };
    var type = node.type;
    var cls = classes[type];

    var tempClass = b3.Class(cls);
    tempClass.prototype.name = node.name;
    tempClass.prototype.title = node.title;
    tempClass.prototype.properties =  node.properties ? JSON.parse(JSON.stringify(node.properties)) : {};

    if (node.type == "action") {
      tempClass.prototype.category = node.category || '';
      tempClass.prototype.script = node.script || '';
      tempClass.prototype.output = node.output ? JSON.parse(JSON.stringify(node.output)) : {};
    }

    this.registerNode(tempClass);
    this.trigger('nodeadded', tempClass);

    this.exportNodes();
  }
  p.editNode = function(oldName, newNode) {
    var node = this.nodes[oldName];
    if (!node) return;

    if (oldName !== newNode.name && this.nodes[newNode.name]) {
      this.logger.error('Node named "'+newNode.name+'" already registered.');
      return;
    }

    delete this.nodes[oldName];
    this.nodes[newNode.name] = node;

    var oldTitle = node.prototype.title;
    node.prototype.name = newNode.name;
    node.prototype.title = newNode.title;
    if (newNode.properties)
      node.prototype.properties = JSON.parse(JSON.stringify(newNode.properties));
    if (node.prototype.type == "action") {
      if (newNode.output)
       node.prototype.output = JSON.parse(JSON.stringify(newNode.output));
      if (newNode.script)
       node.prototype.script = newNode.script;
      if (newNode.category)
        node.prototype.category = newNode.category;
    }

    for (var i=this.blocks.length-1; i>=0; i--) {
      var block = this.blocks[i];
      if (block.node === node) {
        block.name = newNode.name;
        if (block.title === oldTitle || block.title === oldName) {
          block.title = newNode.title || newNode.name;
        }
        block.redraw();
      }
    }

    this.exportNodes();
    this.trigger('nodechanged', node);

    this.exportNodes();
  }
  p.removeNode = function(name) {
    // TODO: verify if it is b3 node
    this.deselectAll();

    var node = this.nodes[name];

    for (var i=this.blocks.length-1; i>=0; i--) {
      var block = this.blocks[i];
      if (block.node === node) {
        this.removeBlock(block);
      }
    }

    delete this.nodes[name];
    this.trigger('noderemoved', node);

    this.exportNodes();
  }
  p.addTree = function() {
    var block = new b3editor.Block(this.nodes['Root']);
    block.displayObject.x = 0;
    block.displayObject.y = 0;

    var tree = new b3editor.Tree();
    tree.id = block.id;
    tree.blocks = [block];
    this.trees.push(tree);

    this.trigger('treeadded', tree);

    this.selectTree(tree.id);
    this.select(this.blocks[0]);
    this.center();

    return tree;
  }
  p.selectTree = function(id) {
    var tree = this.tree;
    if (tree) {
      tree.blocks = this.blocks;
      tree.connections = this.connections;
      tree.selectedBlocks = this.selectedBlocks;
      tree.camera = {
        'camera_x' : this.canvas.camera.x,
        'camera_y' : this.canvas.camera.y,
        'camera_z' : this.canvas.camera.scaleX,
        'x'        : this.blocks[0].displayObject.x,
        'y'        : this.blocks[0].displayObject.y
      }
    }

    for (var i=0; i<this.trees.length; i++) {
      tree = this.trees[i];
      if (tree.id === id) {
        this.tree = tree;

        this.blocks = tree.blocks;
        this.connections = tree.connections;
        this.selectedBlocks = tree.selectedBlocks;

        this.canvas.layerBlocks.removeAllChildren();
        this.canvas.layerConnections.removeAllChildren();

        for (var i=0; i<this.blocks.length; i++) {
          this.canvas.layerBlocks.addChild(this.blocks[i].displayObject);
        }
        for (var i=0; i<this.connections.length; i++) {
          this.canvas.layerConnections.addChild(this.connections[i].displayObject);
        }

        this.canvas.camera.x = tree.camera['camera_x'];
        this.canvas.camera.y = tree.camera['camera_y'];
        this.canvas.camera.scaleX = tree.camera['camera_z'];
        this.canvas.camera.scaleY = tree.camera['camera_z'];

        this.trigger('treeselected', tree);

        this.canvas.stage.update();
        return;
      }
    }

    this.logger.error('Trying to select an invalid tree.');
  }
  p.removeTree = function(id) {
    var index = -1;
    var tree = null;
    for (var i=0; i<this.trees.length; i++) {
      if (this.trees[i].id === id) {
        tree = this.trees[i];
        index = i;
        break;
      }
    }
    if (index > -1) {
      this.trees.splice(index, 1);

      if (tree === this.tree) {
        var id_ = null;
        if (index > 0) id_ = this.trees[index-1].id;
        else id_ = this.trees[index].id;

        this.selectTree(id_);
      }

      this.trigger('treeremoved', tree);
    }
  }
  // ==========================================================================

  // VIEWER ===================================================================
  p.zoom = function(factor) {
    this.canvas.camera.scaleX = factor;
    this.canvas.camera.scaleY = factor;
  }
  p.pan = function(x, y) {
    this.canvas.camera.x += x;
    this.canvas.camera.y += y;
  }
  p.setcam = function(x, y) {
    this.canvas.camera.x = x;
    this.canvas.camera.y = y;
  }
  p.center = function() {
    var hw = this.canvas.canvas.width/2;
    var hh = this.canvas.canvas.height/2;
    this.setcam(hw, hh);
  }
  p.organize = function(orderByIndex) {
    this.organizer.organize(this.getRoot(), orderByIndex);
  }
  p.reset = function(all) {
    // REMOVE BLOCKS
    for (var i=0; i<this.blocks.length; i++) {
      var block = this.blocks[i];
      this.canvas.layerBlocks.removeChild(block.displayObject);
    }
    this.blocks = [];

    // REMOVE CONNECTIONS
    for (var i=0; i<this.connections.length; i++) {
      var conn = this.connections[i];
      this.canvas.layerConnections.removeChild(conn.displayObject);
    }
    this.connections = [];

    this.canvas.camera.x = 0;
    this.canvas.camera.y = 0;
    this.canvas.camera.scaleX = 1;
    this.canvas.camera.scaleY = 1;

    if (!all) {
      this.addBlock('Root', 0, 0);
      this.tree.id = this.blocks[0].id;
      this.tree.blocks = [this.blocks[0]];
    }
  }
  p.snap = function(blocks) {
    if (!blocks) {
      blocks = this.blocks;
    }
    else if (Object.prototype.toString.call(blocks) !== '[object Array]') {
      blocks = [blocks];
    }

    var snap_x = this.settings.get('snap_x');
    var snap_y = this.settings.get('snap_y');

    for (var i=0; i<blocks.length; i++) {
      var block = blocks[i];
      block.displayObject.x -= block.displayObject.x%snap_x;
      block.displayObject.y -= block.displayObject.y%snap_y;
    }
  }
  p.addBlock = function(name, x, y) {
    x = x || 0;
    y = y || 0;

    if (typeof name == 'string') {
      var node = this.nodes[name];
    } else {
      var node = name;
    }

    var block = new b3editor.Block(node);
    block.displayObject.x = x;
    block.displayObject.y = y;

    this.blocks.push(block);
    this.canvas.layerBlocks.addChild(block.displayObject);

    this.deselectAll()
    this.select(block);

    return block;
  }
  p.addConnection = function(inBlock, outBlock) {
    var connection = new b3editor.Connection(this);

    if (inBlock) {
      connection.addInBlock(inBlock);
      inBlock.addOutConnection(connection);
    }

    if (outBlock) {
      connection.addOutBlock(outBlock);
      outBlock.addInConnection(connection);
    }

    this.connections.push(connection);
    this.canvas.layerConnections.addChild(connection.displayObject);

    connection.redraw();

    return connection;
  }
  p.editBlock = function(block, template) {
    var oldValues = {
      title       : block.title,
      description : block.description,
      properties  : block.properties,
      output      : block.output
    }
    block.title       = template.title;
    block.description = template.description;
    block.properties  = template.properties;
    block.output      = template.output;
    block.redraw();

    this.trigger('blockchanged', block, {
      oldValues: oldValues,
      newValues: template
    });
  }
  p.removeBlock = function(block) {
    var index = this.blocks.indexOf(block);
    if (index > -1) this.blocks.splice(index, 1);


    if (block.inConnection) {
      this.removeConnection(block.inConnection);
    }

    if (block.outConnections.length > 0) {
      for (var i=block.outConnections.length-1; i>=0; i--) {
        this.removeConnection(block.outConnections[i]);
      }
    }

    this.canvas.layerBlocks.removeChild(block.displayObject);
  }
  p.removeConnection = function(connection) {
    if (connection.inBlock) {
      connection.inBlock.removeOutConnection(connection);
      connection.removeInBlock();
    }

    if (connection.outBlock) {
      connection.outBlock.removeInConnection();
      connection.removeOutBlock();
    }

    var index = this.connections.indexOf(connection);
    if (index > -1) this.connections.splice(index, 1);

    this.canvas.layerConnections.removeChild(connection.displayObject);
  }
  // ==========================================================================

  // EDITOR INTERFACE =========================================================
  p.select = function(block) {
    if (block.isSelected) return;

    block.select();
    this.selectedBlocks.push(block)

    this.trigger('blockselected', block);
    this.canvas.stage.update();
  }
  p.deselect = function(block) {
    if (!block.isSelected) return;

    block.deselect();
    var index = this.selectedBlocks.indexOf(block);
    if (index > -1) this.selectedBlocks.splice(index, 1);

    this.trigger('blockdeselected', block);
    this.canvas.stage.update();
  }
  p.selectAll = function() {
    for (var i=0; i<this.blocks.length; i++) {
      this.select(this.blocks[i]);
    }
    this.canvas.stage.update();
  }
  p.deselectAll = function() {
    for (var i=this.selectedBlocks.length-1; i>=0; i--) {
      this.deselect(this.selectedBlocks[i])
    }
    this.canvas.stage.update();
  }
  p.invertSelection = function(block) {
    var blocks = (block)?[block]:this.blocks;

    for (var i=0; i<blocks.length; i++) {
      var block = blocks[i];

      if (block.isSelected) {
        this.deselect(block);
      } else {
        this.select(block);
      }
    }
    this.canvas.stage.update();
  }

  p.copy = function() {
    this.clipboard = [];

    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.type != 'root') {
        this.clipboard.push(block)
      }
    }
  }
  p.cut = function() {
    this.clipboard = [];

    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.type != 'root') {
        this.removeBlock(block);
        this.clipboard.push(block)
      }
    }
    this.selectedBlocks = [];
  }
  p.paste = function() {
    var newBlocks = [];
    for (var i=0; i<this.clipboard.length; i++) {
      var block = this.clipboard[i];

      // Copy the block
      var newBlock = block.copy();
      newBlock.displayObject.x += 50;
      newBlock.displayObject.y += 50;

      // Add block to container
      this.blocks.push(newBlock)
      this.canvas.layerBlocks.addChild(newBlock.displayObject);
      newBlocks.push(newBlock);
      newBlock.redraw();
    }

    // Copy connections
    // TODO: cubic complexity here! How to make it better?
    for (var i=0; i<this.clipboard.length; i++) {
      var oldBlock = this.clipboard[i];
      var newBlock = newBlocks[i];

      for (var j=0; j<oldBlock.outConnections.length; j++) {
        for (var k=0; k<this.clipboard.length; k++) {
          if (oldBlock.outConnections[j].outBlock === this.clipboard[k]) {
            this.addConnection(newBlock, newBlocks[k]);
            break;
          }
        }
      }
    }

    // Deselect old blocks and select the new ones
    this.deselectAll();
    for (var i=0; i<newBlocks.length; i++) {
      this.select(newBlocks[i]);
    }

    this.snap(newBlocks);
  }
  p.duplicate = function() {
    var tempClipboard = this.clipboard;
    this.copy();
    this.paste();
    this.clipboard = tempClipboard;
  }
  p.remove = function() {
    var root = null;
    for (var i=0; i<this.selectedBlocks.length; i++) {
      if (this.selectedBlocks[i].type == 'root') {
        root = this.selectedBlocks[i];
      } else {
        this.removeBlock(this.selectedBlocks[i]);
      }
    }

    this.deselectAll();
    if (root) {
      this.select(root);
    }
  }

  p.removeConnections = function() {
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.inConnection) {
        this.removeConnection(block.inConnection);
      }

      if (block.outConnections.length > 0) {
        for (var j=block.outConnections.length-1; j>=0; j--) {
          this.removeConnection(block.outConnections[j]);
        }
      }
    }
  }
  p.removeInConnections = function() {
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.inConnection) {
        this.removeConnection(block.inConnection);
      }
    }
  }
  p.removeOutConnections = function() {
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.outConnections.length > 0) {
        for (var j=block.outConnections.length-1; j>=0; j--) {
          this.removeConnection(block.outConnections[j]);
        }
      }
    }
  }

  p.zoomIn = function() {
    var min = this.settings.get('zoom_min');
    var max = this.settings.get('zoom_max');
    var step = this.settings.get('zoom_step');

    var zoom = this.canvas.camera.scaleX;
    this.zoom(creatine.clip(zoom+step, min, max));
  }
  p.zoomOut = function() {
    var min = this.settings.get('zoom_min');
    var max = this.settings.get('zoom_max');
    var step = this.settings.get('zoom_step');

    var zoom = this.canvas.camera.scaleX;
    this.zoom(creatine.clip(zoom-step, min, max));
  }

  p.preview = function(name) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('width', '400');
    canvas.setAttribute('height', '200');
    canvas.setAttribute('class', 'preview grabbing');

    var node = this.nodes[name];
    var block = new b3editor.Block(node);
    var shape = block.displayObject;
    shape.x = 200;
    shape.y = 100;
    var stage = new createjs.Stage(canvas);
    stage.addChild(shape);
    stage.update();

    var img = document.createElement("img");
    img.src = canvas.toDataURL();

    return img;
  }
  // ==========================================================================

  b3editor.Editor = Editor;
}());
