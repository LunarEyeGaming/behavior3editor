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

    this.maxStoredCommands = this.settings.get("max_stored_commands");

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
    // undo history for the list of nodes.
    this.globalNodeUndoHistory = new b3editor.NodeUndoStack({defaultMaxLength: this.maxStoredCommands});

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
  /**
   * Imports a block from a JSON node. If the block has no associated node definition in the editor, this method logs a
   * warning message, and the block is marked as unregistered. This method will also try to resolve the node definition
   * associated with the block if the block is a module. For this functionality to work properly, the programmer must
   * have set `this.projectTrees` to the most recent result of `this.project.findTrees()` prior to calling this method.
   * 
   * @param {object} node the node to import
   * @param {string} parent the ID of the block to set as the import block's parent
   * @returns the block that was imported
   */
  p.importBlock = function(node, parent) {
    var isRegistered = true;

    // If the node is a module and it is not registered...
    if (node.type === "module" && this.nodes[node.name] == undefined) {
      // Try to find and import it.
      var moduleData = this.findModule(node.name);
      if (moduleData) {
        // Import module
        this.importModule(moduleData);
      }
    }

    var nodeDef = this.nodes[node.name];

    // If the node is not registered (even if it's a module and we tried to resolve it)...
    if (this.nodes[node.name] == undefined) {
      // Report the unregistered node.
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
    
    // The block is invalid if and only if it is registered but the type of the node does not match that in the 
    // corresponding definition.
    var isInvalid = isRegistered && nodeDef.prototype.type !== node.type;

    // If the block is invalid...
    if (isInvalid)
      this.logger.warn("Node named '" + node.name + "' has type '" + node.type + "', but the node was defined to have type '" + nodeDef.prototype.type + "'");

    // Add the block based on the node itself (disable initial rendering and selection).
    var block = this.makeAndAddBlock(nodeDef, 0, 0, false, false);
    block.id = b3.createUUID();
    block.title = node.title;
    block.type = node.type;  // Displays the original type in case it is invalid.
    block.description = node.description;
    block.isRegistered = isRegistered;
    block.isInvalid = isInvalid;

    // If the node is registered and valid...
    if (isRegistered && !isInvalid) {
      this.fillBlockAttributes(block, node);
    } else {  // Otherwise...
      this.fillBlockAttributesNoProto(block, node);
    }

    // If a parent was specified, connect the block to it.
    if (parent) {
      var outBlock = this.getBlockById(parent);
      // Connections will be redrawn during the organize stage, so do not render them yet.
      this.makeAndAddConnection(outBlock, block, false);
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

    // Connections will be redrawn during the organize stage, so do not render them yet.
    block.redraw(false);

    return block
  }
  /**
   * Copies the properties and output of the `node` to `block` based on the associated node definition. For this to 
   * work, the corresponding definition of the node must be registered.
   * 
   * @param {b3editor.Block} block: the block of which to fill the properties and output
   * @param {object} node: the node from which to copy the properties and output.
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
   * @param {object} node: the node from which to copy the properties and output.
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
  /**
   * Imports a module node definition based on the provided `data`.
   * 
   * @param {object} data the data of the module to import
   */
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

      // Update the status of each block.
      this.updateAllBlocks(data.name);
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
    this.addTree(filename);

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

  /**
   * Writes a tree to disk, logs that the tree was saved, shows a notification for it in the GUI, and emits the 
   * "treesaved" event for that tree. Has no effect if the tree does not have a defined path.
   * 
   * @param {b3editor.Tree} tree (optional) the tree to write to disk. Defaults to the currently selected tree.
   */
  p.writeTreeFile = function(tree) {
    tree = tree || this.tree;

    var json = this.exportToJSON();
    var path = tree.path;
    var editor = this;

    if (path != "") {
      fs.writeFile(path, json, function(err){
        if (err) throw err;

        // Mark undo history as saved.
        tree.undoHistory.save();

        // Broadcast treesaved event (for filename directive).
        editor.trigger("treesaved", tree);

        editor.logger.info("Saved tree "+name)
        editor.trigger('notification', name, {
          level: 'success',
          message: 'Saved'
        });
      });
    }
  }
  /**
   * Saves a tree. If the `tree` argument is defined, this method will save that tree. Otherwise, it will save the 
   * currently selected tree. If `useExistingPath` is true, then this method will try to use the tree's path, if 
   * defined. Otherwise, it shows a save dialog for the user to save the tree. After saving the tree, a function
   * `postSaveCallback` will be called if defined.
   * 
   * @param {boolean} useExistingPath whether or not the tree's existing path should be used
   * @param {b3editor.Tree} tree (optional) the tree to save. Defaults to the currently selected tree.
   * @param {() => void} postSaveCallback (optional) the function to call after saving.
   */
  p.saveTree = function(useExistingPath, tree, postSaveCallback) {
    tree = tree || this.tree;
    postSaveCallback = postSaveCallback || function() {};  // Default to a no-args function that does nothing

    var path = tree.path;

    var editor = this;

    var saveTreeHelper = function() {
      // If we should not use the existing path or the path is an empty string (i.e., not defined)...
      if (!useExistingPath || path == "") {
        // Show the save dialog for it.
        dialog.showSaveDialog(remote.getCurrentWindow(), {
          title: "Save Behavior File",
          // The original save path or the name of the tree, whichever is defined.
          defaultPath: path || tree.blocks[0].title,
          filters: [
            { name: "Behavior", extensions: ['behavior']},
            { name: "All files", extensions: ['*']}
          ]
        }, function(filename) {
          if (filename) {
            tree.path = filename;

            editor.writeTreeFile(tree);

            postSaveCallback();
          }
        });
      } else {
        editor.writeTreeFile(tree);

        postSaveCallback();
      }
    }

    // Show warning if the tree has invalid blocks.
    this.conditionalWarning({
      predicate: () => this.hasInvalidBlocks(),
      message: "The tree '" + tree.blocks[0].title + "' contains node type conflicts. Are you sure you want to save?",
      choices: [
        {name: "Yes", triggersCallback: true},
        {name: "No", triggersCallback: false}
      ],
      conditionalCallback: saveTreeHelper
    });
  }
  p.loadProject = function(project) {
    // If a project is already loaded...
    if (this.project) {
      try {
        // Save the project.
        fs.writeFileSync(this.project.fileName, this.project.save());
      } catch (err) {
        // Report error.
        this.logger.error("Error occurred while saving project: " + err);
      }
    }

    // Actually load the project.
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
    this.globalNodeUndoHistory.saveHierarchy(categoriesToExport);
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
  // corresponding to that `originDirectory` and `category`. Has no effect if no project is loaded or the origin 
  // directory evaluates to a falsy value (i.e., is an empty string, null, or undefined)
  p.addToExportHierarchy = function(originDirectory, category) {
    // If no project is loaded or the origin directory is falsy...
    if (!this.project || !originDirectory) {
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

  /**
   * Returns the list of origin directories used by each node.
   * 
   * @returns the list of origin directories used by each node.
   */
  p.getOriginDirectories = function() {
    var dirs = [];
    var dirsLookupTable = {};

    // For each node in the editor...
    for (var nodeName in this.nodes) {
      var originDirectory = this.nodes[nodeName].prototype.originDirectory;

      // If the origin directory is defined and is not already in the dirsLookupTable object...
      if (originDirectory && !dirsLookupTable[originDirectory]) {
        dirs.push(originDirectory);
        dirsLookupTable[originDirectory] = true;
      }
    }

    return dirs;
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
        nodesImported.push(nodeClass);
      }
    }

    // If any nodes are constructed...
    if (nodesImported.length > 0) {
      // If this method call is meant to be a command...
      if (isCommand) {
        // Make a list of affected node groups.
        var affectedGroups = nodesImported.map(nodeClass => {
          return {
            originDirectory,
            category: nodeClass.prototype.category,
            type: nodeClass.prototype.type
          };
        });
        // Add the command (with an undefined ID).
        this.pushCommandNode(affectedGroups, 'ImportNodes', {nodes: nodesImported})
      } else {  // Otherwise...
        // Add the nodes individually.
        nodesImported.forEach(node => this.addNode(node));
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
      this.logger.error('Node named "'+node.name+'" already registered.');
      return;
    }

    // If the node has corresponding (unregistered) blocks that differ in type...
    if (this.hasMismatchedBlocks(node.name, node.type)) {
      // Report it and abort
      this.logger.error("Node type '" + node.type + "' conflicts with type of existing node. Hint: Did you input the correct type?");
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

    tempClass.prototype.originDirectory = originDirectory;

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
    var nodeClass = this.makeNode(node, originDirectory || '');

    // If a node class was returned...
    if (nodeClass)
      this.addNode(nodeClass);

    return nodeClass;
  }
  /**
   * Adds a `node` to the editor, updating the export hierarchy if the `type` of `node` is "action".
   * 
   * @param {b3editor.Composite | b3editor.Action | b3editor.Decorator | b3editor.Module} node the node to add
   */
  p.addNode = function(node) {
    this.registerNode(node);
    this.trigger('nodeadded', node);

    // Update the export hierarchy
    this.addToExportHierarchy(node.prototype.originDirectory, node.prototype.category || node.prototype.type);
  }
  /**
   * Returns whether or not there exists a block `block` in all loaded trees such that `block.name === nodeName` and
   * `block.type !== nodeType`.
   * 
   * @param {string} nodeName the names of the blocks to check
   * @param {string} nodeType the type of the node to check
   * @returns true if a block is found with a matching name and mismatching type, false otherwise.
   */
  p.hasMismatchedBlocks = function(nodeName, nodeType) {
    // For each loaded tree...
    for (var i = 0; i < this.trees.length; i++) {
      var tree = this.trees[i];

      // For each block in that tree...
      for (var j = 0; j < tree.blocks.length; j++) {
        var block = tree.blocks[j];

        // If that block's name matches the name of the node but has a different type...
        if (block.name === nodeName && block.type !== nodeType)
          return true; // Stop and return true.
      }
    }

    // Return false if no such block is found.
    return false;
  }
  /**
   * Returns whether or not the current tree has invalid blocks. Invalid blocks have types that conflict with the type
   * given in their corresponding node definitions.
   * 
   * @returns true if the current tree has at least one invalid block, false otherwise.
   */
  p.hasInvalidBlocks = function() {
    // For each block in the current tree...
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];

      // If the block is invalid...
      if (block.isInvalid)
        return true;
    }

    // Return false if no such block is found.
    return false;
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
      var oldNodeProto = this.nodes[oldName].prototype;
      var affectedGroups = [
        {originDirectory: oldNodeProto.originDirectory, category: oldNodeProto.category, type: oldNodeProto.type},
        {originDirectory, category: newNode.category, type: oldNodeProto.type}
      ];

      this.pushCommandNode(affectedGroups, 'EditNode', {oldName, newNode, originDirectory});
    } else {
      this.editNodeForce(oldName, newNode, originDirectory);
    }
  }
  // Actually makes the changes that need to be made.
  p.editNodeForce = function(oldName, newNode, originDirectory) {
    var node = this.nodes[oldName];

    var oldOriginDirectory = node.prototype.originDirectory;
    var oldCategory = node.prototype.category;

    // Remove the node from the export hierarchy.
    // this.removeFromExportHierarchy(this.nodes[oldName].prototype.originDirectory, 
    //   this.nodes[oldName].prototype.category || this.nodes[oldName].prototype.type);

    // Remove old node from the node definition list.
    delete this.nodes[oldName];
    this.nodes[newNode.name] = node;

    var oldTitle = node.prototype.title;
    node.prototype.name = newNode.name;
    node.prototype.title = newNode.title;
    node.prototype.originDirectory = originDirectory;

    // Update the export hierarchy
    this.addToExportHierarchy(originDirectory, node.prototype.category || node.prototype.type);

    if (newNode.properties)
      node.prototype.properties = JSON.parse(JSON.stringify(newNode.properties));
    if (node.prototype.type == "action") {
      node.prototype.output = JSON.parse(JSON.stringify(newNode.output));
      node.prototype.script = newNode.script;
      node.prototype.category = newNode.category;
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
  
          // Because the size of the block can change due to renames, both the blocks AND the connections need to be
          // redrawn.
          block.redraw();
        }
      });
    });

    // Update statuses of blocks (because renaming the node could result in some unregistered nodes becoming registered
    // and possibly even invalid).
    this.updateAllBlocks(newNode.name);

    this.trigger('nodechanged', node, {oldOriginDirectory, oldCategory});
  }
  /**
   * Removes a node from the editor. This marks all blocks with that node's name as unregistered.
   * 
   * @param {string} name the name of the node to remove
   */
  p.removeNode = function(name) {
    // TODO: verify if it is b3 node
    this.deselectAll();

    var node = this.nodes[name];

    // Update the export hierarchy.
    // this.removeFromExportHierarchy(node.prototype.originDirectory, node.prototype.category || node.prototype.type);

    delete this.nodes[name];
    this.trigger('noderemoved', node);

    this.updateAllBlocks(name);
  }

  /**
   * Adds a new tree to the editor and returns it. If a `filename` is given, the `path` attribute is set automatically.
   * 
   * @param {string} filename (optional) the value to use for the `path` attribute of the new tree
   * @returns the tree that was added
   */
  p.addTree = function(filename) {
    var block = new b3editor.Block({node: this.nodes['Root']});
    block.displayObject.x = 0;
    block.displayObject.y = 0;

    var tree = new b3editor.Tree({maxStoredCommands: this.maxStoredCommands});
    tree.id = block.id;
    tree.blocks = [block];

    // If the filename is given...
    if (filename)
      tree.path = filename;  // Set the tree's path to it.

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

    // Find the tree.
    for (var i=0; i<this.trees.length; i++) {
      if (this.trees[i].id === id) {
        tree = this.trees[i];
        index = i;
        break;
      }
    }
    // If the tree was found...
    if (index > -1) {
      var editor = this;

      // What actually does the removing.
      var removeTreeHelper = function() {
        editor.trees.splice(index, 1);

        // If the current tree was removed...
        if (tree === editor.tree) {
          // Select another tree to view.
          var id_ = null;
          if (index > 0) id_ = editor.trees[index-1].id;
          else id_ = editor.trees[index].id;

          editor.selectTree(id_);
        }

        editor.trigger('treeremoved', tree);
      }

      // Activate conditional warning.
      this.conditionalWarning({
        predicate: () => !tree.undoHistory.isSaved(),
        conditionalCallback: removeTreeHelper,
        message: "The tree '" + tree.blocks[0].title + "' is unsaved. Do you want to save the tree before removing it?",
        choices: [
          {name: "Yes", triggersCallback: false},
          {name: "No", triggersCallback: true},
          {name: "Cancel", triggersCallback: false}
        ],
        dialogCallback: function(result) {
          // If the user selected "yes"...
          if (result === 0)
            editor.saveTree(true, tree, removeTreeHelper);
        }
      });
    }
  }
  // TODO: Move to separate module.
  /**
   * Calls to this function should include a reference to "this" within the context of the Editor object as the first
   * argument. Returns a second function to actually use as the `window.onbeforeunload` replacement. The inner function
   * is to be triggered when the user attempts to close or refresh the application.
   * 
   * @param {*} this_ a reference to the Editor's `this`
   * @returns a function to call before the application is about to exit or reload
   */
  p.onExit = function(this_) {
    // Close the window.
    function closeWindow() {
      // Dumb stupid workaround: Set window.onbeforeunload to do nothing and then force close this window. This
      // prevents this.onExit's inner function from being called unnecessarily.
      window.onbeforeunload = function() {
        return;
      };
      this_.onApplicationClose();  // Handle exiting the application.
      window.close();
    }

    // Warn about unsaved nodes if necessary.
    function unsavedNodesWarning(e) {
      // If there are any unsaved nodes...
      if (!this_.globalNodeUndoHistory.isSaved()) {
        // Asynchronous function. The function returned from onExit will have returned by the time the message box has 
        // opened.
        dialog.showMessageBox(remote.getCurrentWindow(), {
          message: "Are you sure you want to close the application? If so, all unsaved nodes will be lost.",
          type: "warning",
          buttons: ["Yes", "No"]
        }, function(result) {
          switch (result) {
            case 0:  // "Yes"
              // Attempt to show warning, then close window.
              unsavedTreesWarning(e, true);
              break;
            // "No" will do nothing.
          }
        });

        e.returnValue = false;  // Arbitrary value. Prevents the window from closing at first.
      } else {
        unsavedTreesWarning(e);
      }
    }

    // Warn about unsaved trees if necessary.
    // closeOnNoWarning is whether or not the function should forcibly close the window if no warning shows up.
    function unsavedTreesWarning(e, closeOnNoWarning) {
      // Returns a no-args function that saves all trees in `trees` starting from `i`, one by one, and then closes the 
      // window.
      function saveTreesGen(trees, i) {
        return function() {
          // If the number of remaining trees to save is 0 (base case)...
          if (i === trees.length)
            closeWindow();
          else  // Otherwise...
            this_.saveTree(true, trees[i], saveTreesGen(trees, i + 1));
        }
      }
      // Curried to make it so that this function can be given the arguments to be actually called later. This function 
      // shows a warning assuming that there is at least one unsaved tree.
      function unsavedTreesWarningHelperGen(unsavedTrees, i) {
        return function() {
          // If the number of trees remaining is 1 (base case)...
          if (unsavedTrees.length - i === 1) {
            // Show the warning for one unsaved tree.
            dialog.showMessageBox(remote.getCurrentWindow(), {
              message: "Save changes to tree '" + unsavedTrees[i].blocks[0].title + "'?",
              type: "warning",
              buttons: ["Yes", "No", "Cancel"]
            }, function(result) {
              switch (result) {
                case 0:  // Yes
                  // Save the tree, then close the window.
                  this_.saveTree(true, unsavedTrees[i], closeWindow);
                  break;
                case 1:  // No
                  closeWindow();
                  break;
                // "Cancel" does nothing.
              }
            });
          }  // Otherwise...
          else {
            // Show the warning for more than one unsaved tree.
            dialog.showMessageBox(remote.getCurrentWindow(), {
              message: "Multiple trees are unsaved. Save changes to tree '" + unsavedTrees[i].blocks[0].title + "'?",
              type: "warning",
              noLink: true,  // Prevent displaying "Yes to All" and "No to All" as command links.
              buttons: ["Yes", "No", "Yes to All", "No to All", "Cancel"]
            }, function(result) {
              switch (result) {
                case 0:  // Yes
                  // Save the tree and proceed to the next one.
                  this_.saveTree(true, unsavedTrees[i], unsavedTreesWarningHelperGen(unsavedTrees, i + 1));
                  break;
                case 1:  // No
                  // Do not save the tree, but proceed to the next one.
                  unsavedTreesWarningHelperGen(unsavedTrees, i + 1)();
                  break;
                case 2:  // Yes to All
                  // Save all of the remaining trees.
                  saveTreesGen(unsavedTrees, i)();
                  break;
                case 3:  // No to All
                  // Close the window.
                  closeWindow();
                  break;
                // Cancel does nothing
              }
            })
          }
        }
      }

      var unsavedTrees = this_.findUnsavedTrees();

      // If at least one unsaved tree exists...
      if (unsavedTrees.length > 0) {
        // Begin warning chain.
        unsavedTreesWarningHelperGen(unsavedTrees, 0)();

        e.returnValue = false;  // Arbitrary value. Prevents the window from closing at first.
      }  // Otherwise, if the window should be closed...
      else if (closeOnNoWarning) {
        closeWindow();
      }

      // Otherwise, allow the window to close.
    }
    /**
     * Overview of function behavior: Performs two checks before closing the application: Whether all nodes are saved 
     * and whether all trees are saved. If either of them fail, then this function will block the application from 
     * closing and show a corresponding message box for each check that failed. The first message asks the user if they
     * want to close the application despite some nodes being unsaved. Selecting "No" will stop the application from 
     * closing altogether. The second message (or rather, series of messages) asks the user whether or not they want to
     * save each unsaved tree, with a third option to "Cancel", or stop the application from closing. Additional buttons
     * for saving all of them or saving none of them may show up too if more than one tree is unsaved. Due to the
     * used version of Electron not supporting synchronous calls to opening any form of dialog, recursion is necessary
     * to handle all of these cases.
     */
    return function(e) {
      unsavedNodesWarning(e);
    }
  }

  /**
   * The method to call right before the application closes. This method saves the currently loaded project if
   * applicable.
   */
  p.onApplicationClose = function() {
    // TODO: consider cases where writing fails.
    // If a project is loaded...
    if (this.project) {
      // Save it.
      fs.writeFileSync(this.project.fileName, this.project.save());
    }
  }
  // ==========================================================================

  // UNDO HISTORY METHODS =====================================================
  /**
   * Adds a command with name `cmd` and arguments `args` to the undo history corresponding to the current tree, 
   * automatically supplying the `editor` argument as this current editor. If `fromPropertyPanel` is true, sets the 
   * current focused element to the property panel. Otherwise, sets it to the tree editor canvas.
   * 
   * @param {string} cmd the name of the Command to add
   * @param {object} args an object representing the arguments to supply to the Command's constructor
   * @param {boolean} fromPropertyPanel whether or not this call came from the property panel
   */
  p.pushCommandTree = function(cmd, args, fromPropertyPanel) {
    args.editor = this;

    // Look up the undo history corresponding to the current tree. 
    var undoHistory = this.tree.undoHistory;

    // Add the command with name `cmd` to that undo history.
    undoHistory.addCommand(new b3editor[cmd](args));

    // Emit a treesavestatuschanged event.
    this.trigger('treesavestatuschanged', this.tree, {isSaved: undoHistory.isSaved()});

    // If the call came from the property panel...
    if (fromPropertyPanel)
      this.trigger('changefocus', "right-panel");  // Set the focus to the property panel.
    else  // Otherwise...
      this.trigger('changefocus', "tree-editor");  // Set the focus ot the tree editor.
  }
  /**
   * Adds a command with name `cmd` and arguments `args` to the `NodeUndoStack`, supplying `affectedGroups` to its 
   * `addCommand()` method, automatically supplying the `editor` argument as this current editor. 
   * 
   * @param {object[]} affectedGroups the affected groups to convert into a hash string
   * @param {string} affectedGroups[].originDirectory the origin directory to use
   * @param {string} affectedGroups[].category the category to use as a group ID
   * @param {string} affectedGroups[].type the type to use as the substitute for the category as a group ID
   * @param {string} cmd the name of the Command to add
   * @param {object} args an object representing the arguments to supply to the Command's constructor
   */
  p.pushCommandNode = function(affectedGroups, cmd, args) {
    args.editor = this;
    // Add the command with name `cmd` to the undo history corresponding to the list of nodes.
    this.globalNodeUndoHistory.addCommand(affectedGroups, new b3editor[cmd](args));

    this.trigger('changefocus', "left-panel");  // Set the focus to the node / tree panel.
  }

  /**
   * Returns the list of trees that are currently unsaved.
   * 
   * @returns the list of trees that are unsaved
   */
  p.findUnsavedTrees = function() {
    var unsavedTrees = [];

    // For each tree...
    this.trees.forEach(tree => {
      // If the tree is unsaved...
      if (!tree.undoHistory.isSaved())
        unsavedTrees.push(tree);
    });

    return unsavedTrees;
  }

  /**
   * Calls a function `args.conditionalCallback` if a predicate `args.predicate` is false. If `args.predicate` is true, 
   * shows a dialog box with message `args.message`, the buttons listed in `args.choices`, then calls the function
   * `args.conditionalCallback` when the user selects a choice in `args.choices` whose `triggersCallback` attribute is
   * set to true. If `args.conditionalDialogCallback` is defined, then that function will be called instead. Also
   * invokes a callback `dialogCallback` that performs some extra tasks using the choice made if a dialog box is shown.
   * The `dialogCallback` is optional, and nothing extra will be done if it is undefined.
   * 
   * @param {object} args the arguments to provide to the function
   * @param {() => boolean} args.predicate the predicate to use for showing the warning
   * @param {string} args.message the message to show in the dialog box
   * @param {object[]} args.choices a list of objects determining the buttons to show and which ones will trigger 
   * `conditionalCallback`
   * @param {string} args.choices[].name the name of a button
   * @param {boolean} args.choices[].triggersCallback whether or not clicking the button will trigger 
   * `conditionalCallback`
   * @param {() => void} args.conditionalCallback the function to call, either if `args.predicate` is false or the user
   * chooses to allow it to be called.
   * @param {((number) => void)?} args.dialogCallback (optional) the function to call when the dialog box is shown.
   * @param {(() => void)?} args.conditionalDialogCallback (optional) the function to call if the user chooses it to 
   * allow it to be called. `args.conditionalCallback` is used instead if this parameter is not defined.
   */
  p.conditionalWarning = function(args) {
    // If the predicate returns true...
    if (args.predicate()) {
      // Show a warning and decide later whether to invoke the callback based on the user's input.
      dialog.showMessageBox(remote.getCurrentWindow(), {
        message: args.message,
        type: "warning",
        buttons: args.choices.map(choice => choice.name)  // Button names
      }, function(result) {
        // If the choice corresponding to the button pressed is supposed to trigger `conditionalCallback`...
        if (args.choices[result].triggersCallback) {
          // Invoke conditionalDialogCallback or conditionalCallback, whichever is defined first.
          args.conditionalDialogCallback ? args.conditionalDialogCallback() : args.conditionalCallback();
        }
        // If `dialogCallback` is defined...
        if (args.dialogCallback) {
          // Call it.
          args.dialogCallback(result);
        }
      });
    }  // Otherwise...
    else {
      // Invoke the callback immediately.
      args.conditionalCallback();
    }
  }
  // ==========================================================================

  // RENDERING UTILITY ========================================================
  /**
   * Redraws all blocks in `blocks`, optionally redrawing connections too.
   * 
   * @param {Block[]} blocks the list of blocks to redraw
   * @param {boolean} redrawConnections (optional) whether or not connections should be redrawn too.
   */
  p.redrawBlocks = function(blocks, redrawConnections) {
    blocks.forEach(block => block.redraw(redrawConnections));
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
    return this.organizer.organize(this.getRoot(), orderByIndex);
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
      this.tree.blocks = this.blocks;
    }

    // Center camera.
    this.center();
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
  // `shouldRender` is whether or not the block should be redrawn on creation. `true` by default.
  // `shouldSelect` is whether or not the block should be selected on creation. `true` by default.
  p.makeAndAddBlock = function(name, x, y, shouldRender, shouldSelect) {
    shouldRender = shouldRender !== undefined ? shouldRender : true;
    shouldSelect = shouldSelect !== undefined ? shouldSelect : true;

    x = x || 0;
    y = y || 0;

    if (typeof name == 'string') {
      var node = this.nodes[name];
    } else {
      var node = name;
    }

    var block = new b3editor.Block({node, shouldRender});
    block.displayObject.x = x;
    block.displayObject.y = y;

    if (shouldSelect)
      this.deselectAll();  // We want just the block to add to be selected.

    this.addBlock(block, shouldSelect);

    return block;
  }
  // Registers a Block object into the editor and optionally selects it.
  p.addBlock = function(block, shouldSelect) {

    this.blocks.push(block);
    this.canvas.layerBlocks.addChild(block.displayObject);
  
    if (shouldSelect)
      this.select(block);
  }
  // Registers a Block object into the editor and then updates its register status as well as its title.
  p.addAndUpdateBlock = function(block) {
    this.updateBlock(block);
    this.addBlock(block, true);
  }
  // Creates and adds a connection.
  // `inBlock` is the starting block to use
  // `outBlock` is the ending block to use
  // `shouldRender` determines whether or not the connection should be rendered (in case something will be done that 
  // requires re-rendering anyways). true by default.
  p.makeAndAddConnection = function(inBlock, outBlock, shouldRender) {
    shouldRender = shouldRender !== undefined ? shouldRender : true;

    var connection = new b3editor.Connection(this);

    if (inBlock) {
      connection.addInBlock(inBlock);
    }

    if (outBlock) {
      connection.addOutBlock(outBlock);
    }

    this.addConnection(connection, shouldRender);

    return connection;
  }
  // Registers a connection (which has its inBlock and outBlock fields fully defined) into the editor.
  // `connection` is the connection to add.
  // `shouldRender` determines whether or not the connection should be rendered (in case something will be done that 
  // requires re-rendering anyways). true by default.
  p.addConnection = function(connection, shouldRender) {
    shouldRender = shouldRender !== undefined ? shouldRender : true;

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

    if (shouldRender)
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
   * Updates all blocks with name `name` to fit their associated prototypes and returns the rollback data of any blocks
   * whose attributes were updated, which is a list (potentially empty) of objects each containing the following:
   * * `block`: a reference to the block that was modified.
   * * `originalData`: an object containing the original title, type, name, description, properties, and output of the 
   *   block
   * 
   * @param {string} name the name of the blocks to target
   * @return the old data of any blocks whose attributes were updated
   */
  p.updateAllBlocks = function(name) {
    var rollbackData = [];

    // Go through each tree...
    this.trees.forEach(tree => {
      // Go through each block...
      tree.blocks.forEach(block => {
        // If the block has name "name"...
        if (block.name == name) {
          var oldData = this.updateBlock(block);

          // If the block had its attributes updated...
          if (oldData)
            rollbackData.push({block, oldData});
        }
      })
    });

    return rollbackData;
  }
  /**
   * If the block's name has a corresponding node definition, attempt to update the block's attributes according to the
   * node definition--marking the block as invalid if a type mismatch is detected--and mark the block as registered. 
   * Otherwise, mark the block as unregistered (and valid) and leave everything else unchanged. The block is redrawn if 
   * any actual change was made.
   * 
   * @param {b3editor.Block} block the block to update
   * @returns the original node attributes of the block if they were updated, `null` otherwise
   */
  p.updateBlock = function(block) {
    var wasRegistered = block.isRegistered;
    var wasInvalid = block.isInvalid;
    var oldData = null;

    // If the block's name has a corresponding node definition...
    if (this.nodes[block.name]) {
      // Mark the block as registered.
      block.isRegistered = true;

      var nodeDef = this.nodes[block.name];
      // If the type of the block matches that of the corresponding node definition...
      if (block.type === nodeDef.prototype.type) {
        block.isInvalid = false;  // Mark the block as valid.

        // If the block was unregistered...
        if (!wasRegistered) {
          oldData = block.getNodeAttributes();  // Store a backup of the data.

          block.loadNodeDef(nodeDef);
        }
      } else {  // Otherwise...
        block.isInvalid = true;  // Mark the block as invalid.
      }
    } else {  // Otherwise...
      // Mark the block as unregistered and valid.
      block.isRegistered = false;
      block.isInvalid = false;
    }

    // If something about the block changed...
    if (block.isRegistered !== wasRegistered || block.isInvalid !== wasInvalid)
      block.redraw(false);  // Redraw the block.

    return oldData;
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
          var connection = block.outConnections[j];
          // Make a new connection so that we have a connection between the copied blocks.
          var newConnection = new b3editor.Connection();

          // Find the indices of the blocks corresponding to the old connection, then use them to find their 
          // corresponding copies, which the new connection will have as endpoints.
          // Note: This section of the code will cause an error if a connection with an endpoint that is not selected is 
          // copied to the clipboard.
          var idxIn = copiedBlocks.indexOf(connection.inBlock);
          var idxOut = copiedBlocks.indexOf(connection.outBlock);
          newConnection.addInBlock(this.clipboard.blocks[idxIn]);
          newConnection.addOutBlock(this.clipboard.blocks[idxOut]);

          this.clipboard.connections.push(newConnection);
        }
      }
    }

    return copiedBlocks;
  }
  p.cut = function() {
    var blocksToRemove = this.copy();

    // If there are blocks to remove...
    if (blocksToRemove.length > 0) {
      // Register the command to remove those blocks.
      this.pushCommandTree('RemoveBlocks', {blocks: blocksToRemove});
    }

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

    // If there are blocks to remove...
    if (blocksToRemove.length > 0) {
      // Register the command to remove those blocks.
      this.pushCommandTree('RemoveBlocks', {
        blocks: blocksToRemove
      });
    }

    this.deselectAll();
    if (root) {
      this.select(root);
    }
  }
  // Returns the undo stack corresponding to the currently focused element. Also logs an error and returns null if no 
  // corresponding undo stack exists.
  p.getFocusedUndoStack = function() {
    switch (this.currentFocusedElement) {
      case "left-panel":  // The node / tree panel
        return this.globalNodeUndoHistory;
      case "tree-editor":  // The canvas for editing trees (FALL THROUGH)
      case "right-panel":  // The properties panel
        return this.tree.undoHistory;
      default:
        this.logger.error("INTERNAL ERROR: No undo stack defined for element with id '" + this.currentFocusedElement + "'");
        return null;
    }
  }
  // Emits the save status changing event corresponding to the current focused element.
  p.broadcastSaveStatus = function() {
    switch (this.currentFocusedElement) {
      // case "left-panel":  // The node / tree panel
      //   return this.globalNodeUndoHistory;
      case "tree-editor":  // The canvas for editing trees
        // FALL THROUGH
      case "right-panel":  // The properties panel
        var undoHistory = this.tree.undoHistory;
        this.trigger('treesavestatuschanged', this.tree, {isSaved: undoHistory.isSaved()});
        break;
    }
  }
  // Moves back one command in the undo history for the editor.
  p.undo = function() {
    var undoHist = this.getFocusedUndoStack();

    // If the undo history to refer to is defined...
    if (undoHist) {
      undoHist.undoLastCommand();
    }

    this.broadcastSaveStatus();
  }
  // Moves forward one command in the undo history for the editor.
  p.redo = function() {
    var undoHist = this.getFocusedUndoStack();

    // If the undo history to refer to is defined...
    if (undoHist) {
      undoHist.redoNextCommand();
    }

    this.broadcastSaveStatus();
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

    // If any connections will be removed...
    if (connections.length > 0)
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

    // If any connections will be removed...
    if (connections.length > 0)
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

    // If any connections will be removed...
    if (connections.length > 0)
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
    var block = new b3editor.Block({node});
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

  p.onConditionShowWarning = function(args) {
    // Args: 
    // condition: when it's displayed, 
    // message: the message to display,
    // choices: the buttons to show,
    // callbackChoices: when the callback should be called
    // defaultCallback: 
    // callback: called when choice 0 is made or no warning should be displayed,
    // 
  }
  // ==========================================================================

  b3editor.Editor = Editor;
}());