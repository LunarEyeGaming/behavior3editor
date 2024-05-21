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
    this.exportCounter    = {};
    this.treeUndoHistories = {};
    this.globalNodeUndoHistory = new b3editor.UndoStack();  // undo history for the list of nodes.

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

    // Set exit handler.
    window.onbeforeunload = this.onExit(this);
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
  // Adds a command with name `cmd` and arguments `args` to the undo history corresponding to the current tree, 
  // automatically supplying the `editor` argument as this current editor.
  p.pushCommandTree = function(cmd, args) {
    args.editor = this;
    // Look up the undo history corresponding to the current tree and add the command with name `cmd` to that undo 
    // history.
    this.treeUndoHistories[this.tree.id].addCommand(new b3editor[cmd](args));
  }
  // Adds a command with name `cmd` and arguments `args` to the undo history corresponding to the list of nodes in the
  // editor, automatically supplying the `editor` argument as this current editor.
  p.pushCommandNode = function(cmd, args) {
    args.editor = this;
    // Add the command with name `cmd` to the undo history corresponding to the list of nodes.
    this.globalNodeUndoHistory.addCommand(new b3editor[cmd](args));
  }
  // Do something about the change in the element that is focused.
  p.onFocusChange = function(id) {
    this.currentFocusedElement = id;
  }
  // node is the node to register
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
  // this.projectTrees = this.project.findTrees() should be called before calling this method.
  p.importBlock = function(node, parent) {
    var isRegistered = true;

    // If the node is a module and it is not registered...
    if (node.type === "module" && this.nodes[node.name] == undefined) {
      // Try to find and import it.
      var moduleData = this.findModule(node.name);
      if (moduleData) {
        this.importModule(moduleData);
      }
    }

    var nodeDef = this.nodes[node.name];

    // If the node is not registered (even if it's a module and we tried to resolve it)...
    if (this.nodes[node.name] == undefined) {
      // Report the unregistered node.
      var nodeCopy = JSON.parse(JSON.stringify(node));
      if (nodeCopy.child) delete nodeCopy.child;
      if (nodeCopy.children) delete nodeCopy.children;
      this.logger.warn("Node \"" + node.name + "\" not registered.");

      // Mark as not registered
      isRegistered = false;

      // Make node definition stub (because literally everything relies on the fact that the node definition exists).
      nodeDef = {};
      nodeDef.prototype = {
        title: node.title,
        type: node.type,
        name: node.name,
        properties: {},
        output: {}
      }
    }

    // Add the block based on the node itself.
    var block = this.makeAndAddBlock(nodeDef, 0, 0);
    block.id = b3.createUUID();
    block.title = node.title;
    block.description = node.description;
    block.isRegistered = isRegistered;

    // If the node is registered...
    if (isRegistered) {
      this.fillBlockAttributes(block, node);
    } else {  // Otherwise...
      this.fillBlockAttributesNoProto(block, node);
    }

    // If a parent was specified, connect the block to it.
    if (parent) {
      var outBlock = this.getBlockById(parent);
      this.makeAndAddConnection(outBlock, block);
    }

    // If the node has children...
    if (node.children) {
      for (var i=0; i<node.children.length; i++) {
        // Import each of the children.
        this.importBlock(node.children[i], block.id);
      }
    }
    // If the node has exactly one child...
    if (node.child) {
      // Import the child.
      this.importBlock(node.child, block.id);
    }

    block.redraw();

    return block
  }
  /**
   * Copies the properties and output of the `node` to `block` based on the associated node definition. For this to 
   * work, the corresponding definition of the node must be registered.
   * 
   * @param {b3editor.Block} block: the block of which to fill the properties and output
   * @param {Object} node: the node from which to copy the properties and output.
   */
  p.fillBlockAttributes = function(block, node) {
    block.properties = {};

    var proto = this.nodes[node.name].prototype;
    // Define properties for the block given from the input node.
    for (var key in proto.properties) {
      // If the node used to define the block has a defined key for the corresponding node definition property...
      if (node.parameters[key] !== undefined) {
        // Copy it and set it to be a property of the block.
        block.properties[key] = JSON.parse(JSON.stringify(node.parameters[key]))
      } else {
        // Set the property to have no value.
        block.properties[key] = {value: null}
      }
      block.properties[key].type = proto.properties[key].type
    }

    // If the node is an action...
    if (node.type == 'action') {
      // Define the output for the block given from the input node.
      block.output = {};
      node.output = node.output || {};
      for (var key in proto.output) {
        block.output[key] = {type: proto.output[key].type, key: node.output[key] || null}
      }
    }

    // Prune properties that are not given in the node definition provided by the block.
    for (var key in block.properties) {
      if (block.node.prototype.properties[key] === undefined) {
        this.logger.warn("Deleting property not specified in prototype from \""+node.name+"\": " + key);
        delete block.properties[key];
      }
    }

    // Prune output types that are not given in the node definition provided by the block.
    if (block.type == 'action') {
      for (var key in block.output) {
        if (block.node.prototype.output[key] === undefined) {
          this.logger.warn("Deleting output not specified in prototype from \""+node.name+"\": " + key);
          delete block.output[key];
        }
      }
    }
  }
  /**
   * Copies the properties and output of the `node` to `block`. This method is to be used instead of 
   * fillBlockAttributes() if the associated node definition does not exist (and thus the block is unregistered). Using
   * it on registered blocks will cause errors in functions that rely on the block having an associated node definition.
   * 
   * @param {b3editor.Block} block: the block of which to fill the properties and output
   * @param {Object} node: the node from which to copy the properties and output.
   */
  p.fillBlockAttributesNoProto = function(block, node) {
    block.properties = {};

    // Define properties for the block given from the input node.
    for (var key in node.parameters) {
      block.properties[key] = JSON.parse(JSON.stringify(node.parameters[key]));
    }

    // If the node is an action...
    if (node.type == 'action') {
      // Define the output for the block given from the input node.
      block.output = {};
      node.output = node.output || {};
      for (var key in node.output) {
        block.output[key] = {type: null, key: node.output[key] || null}
      }
    }
  }
  p.importFromJSON = function(json) {
    var data = JSON.parse(json);

    this.logger.info("Import tree "+data.name);

    // Refresh the list of tree paths found before importing the block.
    this.projectTrees = this.project.findTrees();

    var dataRoot = this.importBlock(data.root);
    if (!dataRoot) {
      this.logger.error("Failed to import tree "+data.name);
      return false;
    }

    var root = this.getRoot();
    this.editBlock(root, {
      title: data.name,
      description: data.description || "",
      properties: data.parameters || {}
    })
    this.makeAndAddConnection(root, dataRoot);

    this.importModule(data);

    this.organize(true);
    return true;
  }
  // Imports a module node definition based on the provided `data`.
  p.importModule = function(data) {
    var treeModuleParameters = function(treeParameters) {
      var params = {}
      for (var key in treeParameters) {
        params[key] = {
          type: 'json',
          value: treeParameters[key]
        }
      }
      return params
    }

    var moduleNode = this.nodes[data.name];
    if (moduleNode != undefined && moduleNode.prototype.type == 'module') {
      moduleNode.prototype.properties = treeModuleParameters(data.parameters);
    } else {
      var newNode = {
        name: data.name,
        type: 'module',
        title: '',
        properties: treeModuleParameters(data.parameters)
      }
      this.makeAndAddNode(newNode);
      this.updateBlockRegisterStatus(data.name, true);
    }
  }
  // Finds a module with name `name` and returns the JSON data for it, or null if no such module exists. The programmer
  // must set the variable this.projectTrees to the result of project.findTrees() before beginning a series of 
  // findModule() calls.
  p.findModule = function(name) {
    // For each tree path found within the directory containing the project file...
    for (var i = 0; i < this.projectTrees.length; i++) {
      var treePath = this.projectTrees[i];

      // Attempt to load the file.
      try {
        var treeContents = fs.readFileSync(treePath);
      } catch (err) {  // If an error occurred...
        // Report it and abort processing this tree.
        this.logger.warn("Error while reading file '" + treePath + "': " + err);
        continue;
      }

      // Attempt to parse the file.
      try {
        var treeData = JSON.parse(treeContents);
      } catch (err) {  // If an error occurred...
        // Report it and abort processing this tree.
        this.logger.warn("Error while parsing file '" + treePath + "': " + err);
        continue;
      }

      // If the name of the tree matches `name`...
      if (treeData.name === name) {
        return treeData;  // Return the tree.
      }
    }

    return null;  // This value is returned if no trees matching `name` are found.
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
    this.addTree();
    this.tree.path = filename;

    var editor = this;
    var data = fs.readFileSync(filename);
    if (editor.importFromJSON(data)) {
      //editor.writeTreeFile();
    }
  }
  p.exportBlock = function(block, scripts) {
    var data = {};

    data.title = block.title;
    data.type = block.type;
    data.name = block.name;
    data.parameters = {};
    for (var key in block.properties) {
      if (block.properties[key] != null) {
        if (block.properties[key].value != null)
          data.parameters[key] = {value: block.properties[key].value};
        else if (block.properties[key].key != null)
          data.parameters[key] = {key: block.properties[key].key};
      }
    }

    var script = block.node.prototype.script;
    if (script && script != '') {
      if(scripts.indexOf(script) == -1) {
        scripts.push(script);
      }
    }

    if (block.type == 'action') {
      for (var key in block.output) {
        if (block.output[key] != null && block.output[key].key != null) {
          data.output = data.output || {}
          data.output[key] = block.output[key].key;
        }
      }
    }

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

      var replacer = function(k, v, spaces, depth) {
        if (k == "parameters" || k == "output") {
          // each parameter on one line
          return CustomJSON.stringify(v, function(k2, v2, spaces, depth) {
            return CustomJSON.stringify(v2, null, 0);
          }, spaces, depth + 1)
        } else {
          return CustomJSON.stringify(v, replacer, spaces, depth + 1);
        }
      }
      return CustomJSON.stringify(data, replacer, 2);
    } else {
      return "{}";
    }
  }

  p.writeTreeFile = function() {
    var json = this.exportToJSON();
    var path = this.tree.path;
    var editor = this;

    if (path != "") {
      fs.writeFile(path, json, function(err){
        if (err) throw err;

        editor.logger.info("Saved tree "+name)
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

        // This should only be included here to let the filename display know that the save location has been updated.
        editor.trigger("treesaved", editor.tree);

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
    this.importAllNodes(project.findNodes());
    this.pruneExportHierarchy();

    this.reset();

    this.logger.info("Successfully loaded project")
  }
  // Returns the export data of nodes fitting a specific category "category" and directory of origin "origin".
  // category: the category of nodes to export
  // origin: the directory of origin to filter by
  // return a list of nodes to export (keyed by name), or null if no nodes have been exported.
  p.getNodeCategoryExportData = function(category, origin) {
    var data = {};
    var dataIsEmpty = true;
  
    for (var name in this.nodes) {
      var node = this.nodes[name];
      var nodeCategory = node.prototype.category || node.prototype.type
      if (nodeCategory == category && node.prototype.originDirectory == origin) {
        if (node.prototype.type != "root") {
          dataIsEmpty = false;
          data[name] = {};
          data[name].type = node.prototype.type;
          data[name].name = node.prototype.name;
          data[name].title = node.prototype.title;
          if (node.prototype.properties) {
            data[name].properties = JSON.parse(JSON.stringify(node.prototype.properties));

          }

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

    if (dataIsEmpty)
      return null;

    var replacer = function(k, v, spaces, depth) {
      if (k == "properties" || k == "output") {
        // each parameter on one line
        return CustomJSON.stringify(v, function(k2, v2, spaces, depth) {
          return CustomJSON.stringify(v2, null, 0);
        }, spaces, depth + 1)
      } else {
        return CustomJSON.stringify(v, replacer, spaces, depth + 1);
      }
    }
    return CustomJSON.stringify(data, replacer, 2);
  }
  // Returns JSON data containing the nodes to export
  p.getNodeExportData = function(categoriesToExport) {
    var nodes = {};

    // For each originDirectory key in categoriesToExport...
    for (var origin in categoriesToExport) {
      var categories = categoriesToExport[origin];

      nodes[origin] = {};

      nodes[origin].composite = this.getNodeCategoryExportData("composite", origin)
      nodes[origin].decorator = this.getNodeCategoryExportData("decorator", origin)
      nodes[origin].action = this.getNodeCategoryExportData("action", origin)
      nodes[origin].module = this.getNodeCategoryExportData("module", origin)

      // For each category in categories...
      for (var category in categories) {
        // If the category should be exported...
        if (categories[category]) {
          // Get its export data
          nodes[origin][category] = this.getNodeCategoryExportData(category, origin);
        }
      }
    }
    return nodes;
  }

  // Exports nodes based on an object (called "categoriesToExport") containing hash sets of categories to export each 
  // mapped to an origin directory.
  p.exportNodes = function(categoriesToExport) {
    var nodes = this.getNodeExportData(categoriesToExport);
    for (var origin in nodes) {
      var nodesInDir = nodes[origin];
      for (var category in nodesInDir) {
        if (nodesInDir[category] !== null) {
          // console.log("Category: " + category + ", Origin: " + origin);
          fs.writeFileSync(path.join(path.resolve(this.project.fileName, origin), category + ".nodes"), nodesInDir[category]); 
        }
      }
    }
  }

  // Returns the node exporting hierarchy. A node exporting hierarchy is an object containing the categories associated
  // with each origin directory.
  p.getNodeExportHierarchy = function() {
    return this.project.nodesToExport;
  }
  // Adds a node with `originDirectory` and `category` to the export hierarchy, increasing an internal counter 
  // corresponding to that `originDirectory` and `category`. Has no effect if no project is loaded.
  p.addToExportHierarchy = function(originDirectory, category) {
    // If no project is loaded...
    if (!this.project) {
      return;  // Abort.
    }

    // If the export counter map for the origin directory does not exist...
    if (this.exportCounter[originDirectory] === undefined) {
      this.exportCounter[originDirectory] = {};
    }
    
    // If the counter for the category and origin directory does not exist...
    if (this.exportCounter[originDirectory][category] === undefined) {
      this.exportCounter[originDirectory][category] = 0;
    }

    // Increment counter.
    this.exportCounter[originDirectory][category]++;

    // Update export hierarchy too.
    // If the origin directory is not registered in the export hierarchy...
    if (this.project.nodesToExport[originDirectory] === undefined) {
      this.project.nodesToExport[originDirectory] = {};
    }

    // If the category is not registered in the export hierarchy...
    if (this.project.nodesToExport[originDirectory][category] === undefined) {
      this.project.nodesToExport[originDirectory][category] = true;
    }
  }
  // Deregisters a node with the given `originDirectory` and `category` from the export hierarchy, thus decrementing the
  // corresponding counter. If the counter reaches 0, the entry gets removed as appropriate. If the corresponding 
  // counter does not exist, this method will have no effect.
  p.removeFromExportHierarchy = function(originDirectory, category) {
    var exportHierarchy = this.project.nodesToExport;
    // If the counter exists...
    if (this.exportCounter[originDirectory] !== undefined && this.exportCounter[originDirectory][category] !== undefined) {
      // Decrement it.
      this.exportCounter[originDirectory][category]--;

      // If there are no more nodes within this part of the hierarchy...
      if (this.exportCounter[originDirectory][category] <= 0) {
        delete this.exportCounter[originDirectory][category];
        delete exportHierarchy[originDirectory][category];

        // If the part of the export hierarchy corresponding to originDirectory no longer has categories...
        if (Object.keys(this.exportCounter[originDirectory]).length == 0) {
          delete this.exportCounter[originDirectory];
          delete exportHierarchy[originDirectory];
        }
      }
    }
  }
  // Clears all entries from the export hierarchy that do not have a corresponding counter.
  p.pruneExportHierarchy = function() {
    // For each originDirectory in the export hierarchy (going backwards)...
    for (var originDirectory in this.project.nodesToExport) {
      // If no corresponding entry exists in the exportCounter...
      if (!this.exportCounter[originDirectory]) {
        delete this.project.nodesToExport[originDirectory];
      } else {  // Otherwise...
        // For each category in the export hierarchy for originDirectory...
        for (var category in this.project.nodesToExport[originDirectory]) {
          // If no corresponding entry exists in the exportCounter...
          if (!this.exportCounter[originDirectory][category]) {
            delete this.project.nodesToExport[originDirectory][category];
          }
        }
      }
    }
  }
  // json is the JSON contents of the .nodes file; originDirectory is the directory from which it originated.
  // isCommand is whether or not to treat the act of importing the nodes as a command.
  p.importNodes = function(json, originDirectory, isCommand) {
    var nodes = JSON.parse(json);
    var nodesImported = [];

    // Go through each node, try to construct it, and add it to the list of nodes to add, nodesImported.
    for (var name in nodes) {
      var node = nodes[name];
      var nodeClass = this.makeNode(node, originDirectory);

      // If the node class is defined...
      if (nodeClass) {
        nodesImported.push({nodeClass, isAction: node.type == 'action'});
      }
    }

    // If any nodes are constructed...
    if (nodesImported.length > 0) {
      // If this method call is meant to be a command...
      if (isCommand) {
        // Add the command.
        this.pushCommandNode('ImportNodes', {nodes: nodesImported})
      } else {  // Otherwise...
        // Add the nodes individually.
        nodesImported.forEach(node => this.addNode(node.nodeClass, node.isAction));
      }
    }
  }
  // Helper function. Shortcut for importing nodes during the loading of the project.
  // nodesPathList is the list of nodes paths to import.
  // originDirectory is the directory from which the list of nodes originated (absolute).
  p.importNodesInit = function(nodesPathList, originDirectory) {
    nodesPathList.forEach(file => {
      this.logger.info("Import nodes from " + path.relative(this.project.fileName, file));
      var json = fs.readFileSync(file);
      this.importNodes(json, path.relative(this.project.fileName, originDirectory));
    });
  }
  // Creates and returns a node definition from a provided raw `node` definition (given by a modal) and an 
  // `originDirectory`.
  p.makeNode = function(node, originDirectory) {
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
    tempClass.prototype.properties = {}
    if (node.properties) {
      for (var key in node.properties) {
        tempClass.prototype.properties[key] = JSON.parse(JSON.stringify(node.properties[key]))
      }
    }

    // Indicate the directory of origin (undefined means that no save location was specified).
    tempClass.prototype.originDirectory = originDirectory || undefined;

    if (node.type == "action") {
      tempClass.prototype.category = node.category || '';
      tempClass.prototype.script = node.script || '';

      tempClass.prototype.output = {}
      if (node.output) {
        for (var key in node.output) {
          if (node.output[key].key === '')
            tempClass.prototype.output[key] = {type: node.output[key].type, key: null}
          else {
            if (node.output[key].value !== undefined) {
              node.output[key].key = node.output[key].value
              delete node.output[key].value
            }
            tempClass.prototype.output[key] = JSON.parse(JSON.stringify(node.output[key]))
          }
        }
      }
    }

    return tempClass;
  }
  // Creates and adds a node to the editor. Returns the node that was added.
  // node is the node to add; originDirectory is the directory from which it originated (relative); isCommand is whether
  // or not this function call counts as a command (i.e., can be undone).
  p.makeAndAddNode = function(node, originDirectory) {
    var nodeClass = this.makeNode(node, originDirectory);

    // If a node class was returned...
    if (nodeClass) {
      var isAction = node.type == "action";

      this.addNode(nodeClass, isAction);
    }

    return nodeClass;
  }
  // Adds a `node` to the editor, updating the export hierarchy if `isAction` is true and updating the register status 
  // and prototype of all blocks if `updateBlocks` is true. Returns an object containing sufficient data to reverse the
  // changes made to the blocks if `updateBlocks` is true. Otherwise, returns undefined. The object returned contains:
  //   connections: the list of connections that were removed in the process, which may be empty.
  //   originalBlocks: a list (which may be empty) of objects each containing the following:
  //    block: a reference to the block that was modified.
  //    originalData: an object containing the original title, type, name, description, properties, and output of the 
  //      block 
  p.addNode = function(node, isAction, updateBlocks) {
    this.registerNode(node);
    this.trigger('nodeadded', node);

    var rollbackData;

    // If we should update the blocks' register status and prototypes...
    if (updateBlocks) {
      rollbackData = {connections: [], originalBlocks: []};

      this.updateBlockRegisterStatus(node.prototype.name, true);
  
      // To update the prototypes, go through each tree...
      this.trees.forEach(tree => {
        // Go through each block...
        tree.blocks.forEach(block => {
          // If the block has the same name as that of the updated prototype...
          if (block.name == node.prototype.name) {
            // Store a backup of the block's original data.
            rollbackData.originalBlocks.push({block, originalData: block.getNodeAttributes()});

            var removedConnections = block.loadNodeDef(node);  // Update its node definition.

            // If there are any removed connections...
            if (removedConnections) {
              // Finish removing the connections.
              removedConnections.forEach(connection => this.removeConnection(connection));
              // Add them to the list of all removed connections.
              rollbackData.connections = rollbackData.connections.concat(removedConnections);
            }

            block.redraw();
          }
        })
      });
    }

    // If the node is an action...
    if (isAction) {
      // Update the export hierarchy
      this.addToExportHierarchy(node.prototype.originDirectory, node.prototype.category);
    }

    return rollbackData;
  }
  // Imports all nodes nodesPaths from the result of Project.findNodes().
  // nodesPaths is an object containing a mainPath, a mainNodes, and a nodesAssoc field. The nodesAssoc field contains
  // an association list that associates each nodes directory with a list of .nodes files to import.
  p.importAllNodes = function(nodesPaths) {
    this.importNodesInit(nodesPaths.mainNodes, nodesPaths.mainPath);
    nodesPaths.otherNodes.forEach(nodesAssoc => {
      var [nodesDir, nodesPathList] = nodesAssoc;
      this.importNodesInit(nodesPathList, nodesDir);
    })
  }
  // originDirectory is the updated directory in which to save the node.
  // isCommand is whether or not the action should be counted as a command.
  p.editNode = function(oldName, newNode, originDirectory, isCommand) {
    if (!this.nodes[oldName]) return;

    if (oldName !== newNode.name && this.nodes[newNode.name]) {
      this.logger.error('Node named "'+newNode.name+'" already registered.');
      return;
    }

    // If the action is a command...
    if (isCommand) {
      this.pushCommandNode('EditNode', {oldName, newNode, originDirectory});
    } else {
      this.editNodeForce(oldName, newNode, originDirectory);
    }
  }
  // Actually makes the changes that need to be made.
  p.editNodeForce = function(oldName, newNode, originDirectory) {
    var node = this.nodes[oldName];

    // Remove the node from the export hierarchy.
    this.removeFromExportHierarchy(this.nodes[oldName].prototype.originDirectory, 
      this.nodes[oldName].prototype.category);

    // Remove old node from the node definition list.
    delete this.nodes[oldName];
    this.nodes[newNode.name] = node;

    var oldTitle = node.prototype.title;
    node.prototype.name = newNode.name;
    node.prototype.title = newNode.title;
    node.prototype.originDirectory = originDirectory;
    if (newNode.properties)
      node.prototype.properties = JSON.parse(JSON.stringify(newNode.properties));
    if (node.prototype.type == "action") {
      node.prototype.output = JSON.parse(JSON.stringify(newNode.output));
      node.prototype.script = newNode.script;
      node.prototype.category = newNode.category;

      // Update the export hierarchy
      this.addToExportHierarchy(originDirectory, node.prototype.category);
    }

    // Across all trees...
    this.trees.forEach(tree => {
      // Update names of blocks
      tree.blocks.forEach(block => {
        if (block.node === node) {
          // Update name
          block.name = newNode.name;
          if (block.title === oldTitle || block.title === oldName) {
            block.title = newNode.title || newNode.name;
          }
  
          // Force redraw
          block.redraw();
        }
      });
    });

    // Update register statuses of blocks (because renaming the node could result in some unregistered nodes becoming 
    // registered).
    this.updateBlockRegisterStatus(newNode.name, true);

    this.trigger('nodechanged', node);
  }
  p.removeNode = function(name, isAction) {
    // TODO: verify if it is b3 node
    this.deselectAll();

    var node = this.nodes[name];

    this.updateBlockRegisterStatus(name, false);

    // If the node is an action...
    if (isAction) {
      // Update the export hierarchy.
      this.removeFromExportHierarchy(this.nodes[name].prototype.originDirectory, this.nodes[name].prototype.category);
    }

    delete this.nodes[name];
    this.trigger('noderemoved', node);
  }
  p.addTree = function() {
    var block = new b3editor.Block(this.nodes['Root']);
    block.displayObject.x = 0;
    block.displayObject.y = 0;

    var tree = new b3editor.Tree();
    tree.id = block.id;
    tree.blocks = [block];
    this.trees.push(tree);

    // Make new tree undo history.
    this.treeUndoHistories[tree.id] = new b3editor.UndoStack();

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

      // Delete the undo history corresponding to the tree that was removed.
      this.treeUndoHistories[tree.id] = undefined;

      if (tree === this.tree) {
        var id_ = null;
        if (index > 0) id_ = this.trees[index-1].id;
        else id_ = this.trees[index].id;

        this.selectTree(id_);
      }

      this.trigger('treeremoved', tree);
    }
  }
  // Calls to this function should include a reference to "this" within the context of the Editor object as the first
  // argument. Returns a second function to actually use as the window.onbeforeunload replacement. The inner function is
  // triggered when the user attempts to close the application.
  p.onExit = function(this_) {
    return function(e) {
      // THIS COMMENTED CODE SHOULD BE KEPT. IT WILL BE USED IN A FUTURE VERSION.
      // // Asynchronous function. The function returned from onExit will have returned by the time the message box has 
      // // opened.
      // // TODO: Make it so that this function blocks the entire program.
      // dialog.showMessageBox({
      //   message: "Test",
      //   type: "warning",
      //   buttons: ["Yes", "No", "Cancel"]
      // }, function(result) {
      //   switch (result) {
      //     case 0:  // Fall through
      //     case 1:
      //       // Dumb stupid workaround: Set window.onbeforeunload to do nothing and then force close this window.
      //       window.onbeforeunload = function() {
      //         return
      //       };
      //       // Save
      //       this_.project.save();
      //       window.close();
      //     // "cancel" (option 2) will do nothing.
      //   }
      // });

      // e.returnValue = false;  // Arbitrary value. Prevents the window from closing at first.

      // TODO: consider cases where writing fails.
      // Currently just saves the project on quitting.
      // If a project is loaded...
      if (this_.project) {
        fs.writeFileSync(this_.project.fileName, this_.project.save());
      }
    }
  }
  // ==========================================================================

  // VIEWER ===================================================================
  p.zoom = function(factor) {
    // Scale the camera's position relative to the mouse's position.
    // This makes it so that everything seems to scale relative to the mouse's position after applying the scale values.
    var oldScale = this.canvas.camera.scaleX;  // Assuming scaling is the same for both axes.
    this.canvas.camera.x = (this.canvas.camera.x - this.canvas.stage.mouseX) / oldScale * factor + this.canvas.stage.mouseX;
    this.canvas.camera.y = (this.canvas.camera.y - this.canvas.stage.mouseY) / oldScale * factor + this.canvas.stage.mouseY;

    // This does the actual zooming.
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
      this.makeAndAddBlock('Root', 0, 0);
      this.tree.id = this.blocks[0].id;
      this.tree.blocks = [this.blocks[0]];
    }

    // Reset undo histories.
    this.treeUndoHistories = {}
    this.treeUndoHistories[this.tree.id] = new b3editor.UndoStack();
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
  // Constructs a Block from a node definition, which is either provided by name (a string) or by a raw definition.
  p.makeAndAddBlock = function(name, x, y) {
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

    this.deselectAll();  // We want just the block to add to be selected.

    this.addBlock(block);

    return block;
  }
  // Registers a Block object into the editor.
  p.addBlock = function(block) {
    this.blocks.push(block);
    this.canvas.layerBlocks.addChild(block.displayObject);
  
    this.select(block);
  }
  // Registers a Block object into the editor and then updates its register status as well as its title.
  p.addAndUpdateBlock = function(block) {
    var wasRegistered = block.isRegistered;
    var oldTitle = block.title;
    block.isRegistered = this.nodes[block.name] != undefined;  // Update register status (the loose equal is important)

    // If the block is registered...
    if (block.isRegistered) {
      // Update the title.
      block.title = this.nodes[block.name].prototype.title;
    }

    // If register status or title changed...
    if (wasRegistered !== block.isRegistered || oldTitle !== block.title) {
      // Force a redraw.
      block.redraw();
    }

    this.addBlock(block);
  }
  p.makeAndAddConnection = function(inBlock, outBlock) {
    var connection = new b3editor.Connection(this);

    if (inBlock) {
      connection.addInBlock(inBlock);
    }

    if (outBlock) {
      connection.addOutBlock(outBlock);
    }

    this.addConnection(connection);

    return connection;
  }
  // Registers a connection (which has its inBlock and outBlock fields fully defined) into the editor.
  p.addConnection = function(connection) {
    var inBlock = connection.inBlock;
    var outBlock = connection.outBlock;

    if (inBlock) {
      inBlock.addOutConnection(connection);
    }

    if (outBlock) {
      outBlock.addInConnection(connection);
    }

    this.connections.push(connection);
    this.canvas.layerConnections.addChild(connection.displayObject);

    connection.redraw();
  }
  p.editBlock = function(block, template) {
    var oldValues = block.getNodeAttributes();

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
  /**
   * Sets all blocks with name `name` to have their `isRegistered` attribute to `status`.
   * @param {string} name the name of the blocks to target
   * @param {boolean} status whether the blocks will be considered "registered"
   */
  p.updateBlockRegisterStatus = function(name, status) {
    // Go through each tree...
    this.trees.forEach(tree => {
      // Go through each block...
      tree.blocks.forEach(block => {
        // If the block has name "name"...
        if (block.name == name) {
          // Update its register status.
          block.isRegistered = status;

          block.redraw();
        }
      })
    });
  }
  /**
   * Removes `connection` from the editor. The original `connection` remains unmodified.
   * 
   * @param {Connection} connection the connection to remove
   */
  p.removeConnection = function(connection) {
    if (connection.inBlock) {
      connection.inBlock.removeOutConnection(connection);
      // connection.removeInBlock();
    }

    if (connection.outBlock) {
      connection.outBlock.removeInConnection();
      // connection.removeOutBlock();
    }

    var index = this.connections.indexOf(connection);
    if (index > -1) this.connections.splice(index, 1);

    this.canvas.layerConnections.removeChild(connection.displayObject);

    this.canvas.stage.update();
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

  // Copies the selected blocks (and connections) to the clipboard and returns the original blocks that were copied.
  p.copy = function() {
    this.clipboard = {blocks: [], connections: []};

    var copiedBlocks = [];  // The original blocks that were copied.

    // Copy blocks.
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.type != 'root') {
        // Making a copy of the block protects it from outside alterations.
        this.clipboard.blocks.push(block.copy());

        copiedBlocks.push(block);
      }
    }

    // Copy connections
    // For each block in the clipboard...
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      // Skip the block that is the root.
      if (block.type == 'root')
        continue;

      // For each child connector from the block...
      for (var j=0; j<block.outConnections.length; j++) {
        // If the block at the end of the connector is defined and selected...
        // (connectors with no outBlock occur if the user copies while in the process of adding a node)
        if (block.outConnections[j].outBlock && block.outConnections[j].outBlock.isSelected) {
          this.clipboard.connections.push(block.outConnections[j]);
        }
      }
    }

    return copiedBlocks;
  }
  p.cut = function() {
    var blocksToRemove = this.copy();

    this.pushCommandTree('RemoveBlocks', {blocks: blocksToRemove});

    this.deselectAll();
  }
  p.paste = function() {
    this.deselectAll();

    var newBlocks = [];
    for (var i=0; i<this.clipboard.blocks.length; i++) {
      var block = this.clipboard.blocks[i];

      // Copy the block (and offset it so that it doesn't overlap)
      var newBlock = block.copy();
      newBlock.displayObject.x += 50;
      newBlock.displayObject.y += 50;

      // Add block to container
      newBlocks.push(newBlock);
    }

    var newConnections = [];
    // For each connection in the list of copied connections...
    this.clipboard.connections.forEach(connection => {
      // Make a new connection (which will become a copy of the original connection).
      var newConnection = new b3editor.Connection();

      // Find the index of the old blocks used in the connection and then use those indices to refer to the new blocks,
      // which we will use as the new endpoints of the copied connection. This is not optimally efficient. Consider 
      // optimizing if necessary.
      // Note: This section of the code will cause an error if a connection with an endpoint that is not selected is 
      // copied to the clipboard.
      var idxIn = this.clipboard.blocks.indexOf(connection.inBlock);
      var idxOut = this.clipboard.blocks.indexOf(connection.outBlock);
      newConnection.addInBlock(newBlocks[idxIn]);
      newConnection.addOutBlock(newBlocks[idxOut]);

      newConnections.push(newConnection);
    })

    // At this point, the copied blocks and connections are not in the editor yet. The command below does that.
    this.pushCommandTree('Paste', {blocks: newBlocks, connections: newConnections});
  }
  p.duplicate = function() {
    var tempClipboard = this.clipboard;
    this.copy();
    this.paste();
    this.clipboard = tempClipboard;
  }
  p.remove = function() {
    var root = null;
    var blocksToRemove = [];

    // Go through selected block and add it to the list of blocks to remove, except for the root.
    for (var i=0; i<this.selectedBlocks.length; i++) {
      if (this.selectedBlocks[i].type == 'root') {
        root = this.selectedBlocks[i];
      } else {
        blocksToRemove.push(this.selectedBlocks[i]);
      }
    }

    this.pushCommandTree('RemoveBlocks', {
      blocks: blocksToRemove
    });

    this.deselectAll();
    if (root) {
      this.select(root);
    }
  }
  // Returns the undo stack corresponding to the currently focused element. Logs an error and returns null if no 
  // corresponding undo stack exists.
  p.getFocusedUndoStack = function() {
    switch (this.currentFocusedElement) {
      case "left-panel":  // The node / tree panel
        return this.globalNodeUndoHistory;
      case "tree-editor":  // The canvas for editing trees
        return this.treeUndoHistories[this.tree.id];
      default:
        this.logger.error("INTERNAL ERROR: No undo stack defined for element with id '" + this.currentFocusedElement + "'");
        return null;
    }
  }
  // Moves back one command in the undo history for the editor.
  p.undo = function() {
    var undoHist = this.getFocusedUndoStack();

    // If the undo history to refer to is defined...
    if (undoHist) {
      undoHist.undoLastCommand();
    }
  }
  // Moves forward one command in the undo history for the editor.
  p.redo = function() {
    var undoHist = this.getFocusedUndoStack();

    // If the undo history to refer to is defined...
    if (undoHist) {
      undoHist.redoNextCommand();
    }
  }

  p.removeConnections = function() {
    var connections = [];

    // Go through each selected block and add all of the connections to remove.
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.inConnection) {
        connections.push(block.inConnection);
      }

      if (block.outConnections.length > 0) {
        for (var j=block.outConnections.length-1; j>=0; j--) {
          connections.push(block.outConnections[j]);
        }
      }
    }

    this.pushCommandTree('RemoveConnections', {connections});
  }
  p.removeInConnections = function() {
    var connections = [];

    // Go through each selected block and add all of the in-connections to remove.
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.inConnection) {
        connections.push(block.inConnection);
      }
    }

    this.pushCommandTree('RemoveConnections', {connections});
  }
  p.removeOutConnections = function() {
    var connections = [];

    // Go through each selected block and add all of the out-connections to remove.
    for (var i=0; i<this.selectedBlocks.length; i++) {
      var block = this.selectedBlocks[i];

      if (block.outConnections.length > 0) {
        for (var j=block.outConnections.length-1; j>=0; j--) {
          connections.push(block.outConnections[j]);
        }
      }
    }

    this.pushCommandTree('RemoveConnections', {connections});
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