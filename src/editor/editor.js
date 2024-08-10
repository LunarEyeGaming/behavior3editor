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
        message: b3editor.escapeHtml(message)
      });
    }
    this.logger.onError = function(message) {
      editor.trigger('notification', "Error", {
        level: 'error',
        message: b3editor.escapeHtml(message)
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
    this.patchNodes       = {};
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
    this.projectTrees = [];

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

  /**
   * Removes all of the node definitions from the editor.
   */
  p.resetNodes = function() {
    // Clear nodes
    this.nodes = {};
    this.categories = {};

    // Add back the root node.
    this.registerNode(b3editor.Root);
    this.trigger("nodesreset");

    
    // Reset undo stack.
    this.globalNodeUndoHistory = new b3editor.NodeUndoStack({defaultMaxLength: this.maxStoredCommands});
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
  /**
   * Finds and returns the root in the given tree `tree`.
   * 
   * @param {Tree} tree the tree from which to get the root.
   * @returns the root of the given tree
   */
  p.getRoot = function(tree) {
    for (var i=0; i<tree.blocks.length; i++) {
      if (tree.blocks[i].type === 'root') {
        return tree.blocks[i];
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
  /**
   * Returns the block with ID `id` in tree `tree` (or the current tree by default).
   * 
   * @param {string} id the ID of the block to find
   * @param {Tree?} tree (optional) the tree in which to search for the block. Defaults to the current tree
   * @returns the block with ID `id` in tree `tree` (or the current tree).
   */
  p.getBlockById = function(id, tree) {
    tree = tree || this.tree;

    for (var i=0; i<tree.blocks.length; i++) {
      var block = tree.blocks[i];
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
   * associated with the block if the block is a module.
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
        this.importModule(moduleData.contents, moduleData.path);
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
  /**
   * Loads a tree into the editor from JSON, logging an error if parsing fails.
   * 
   * @param {string} json a string representation of the JSON to parse
   * @param {string} filePath the path from which the JSON was read
   */
  p.importFromJSON = function(json, filePath) {
    // Handle parse error.
    try {
      var data = JSON.parse(json);
    } catch (err) {
      // Log error and abort.
      this.logger.error("Error while parsing file '" + filePath + "': " + err);
      return;
    }

    this.logger.info("Import tree "+data.name);

    // If a root is defined...
    if (data.root != undefined) {
      var dataRoot = this.importBlock(data.root);
    }

    var root = this.getRoot(this.tree);
    this.editBlock(root, {
      title: data.name,
      description: data.description || "",
      properties: data.parameters || {}
    });
    this.tree.nameSinceLastSave = data.name;

    // If a root is defined (again)...
    if (data.root != undefined)
      this.makeAndAddConnection(root, dataRoot);

    this.importModule(data, filePath);

    this.organize(true);
  }
  /**
   * Imports a module node definition based on the provided `data` and the location from which the module originated
   * `modulePath`. If the module is already in the node definition list, the properties and path to the original tree
   * are overridden. If the `oldName` is provided, then this method will attempt to rename the node definition.
   * 
   * @param {object} data the data of the module to import
   * @param {string} modulePath where the data came from
   * @param {string?} oldName (optional) the old name of the tree.
   */
  p.importModule = function(data, modulePath, oldName) {
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

    var oldName = oldName != undefined ? oldName : data.name;

    var moduleNode = this.nodes[oldName];

    // If the node already exists...
    if (moduleNode != undefined) {
      // If the node is a module...
      if (moduleNode.prototype.type == "module") {
        var newNode = {
          name: data.name,
          title: moduleNode.prototype.title,
          properties: treeModuleParameters(data.parameters),
          pathToTree: modulePath
        };

        // Edit the node directly.
        this.editNode(oldName, newNode, moduleNode.prototype.originDirectory, true);
      } else {
        this.notifyError("Node named '{0}' is already registered and is not a module.", oldName);
      }
    } else {
      var newNode = {
        name: data.name,
        type: 'module',
        title: '',
        properties: treeModuleParameters(data.parameters),
        pathToTree: modulePath
      };

      this.makeAndAddNode(newNode, "");
    }
  }
  /**
   * Attempts to JSON-parse a tree with name `filename`. If successful, removes the node definition corresponding to the
   * tree. Otherwise, has no effect. If failure occurs for a reason besides the file not existing, the error is reported
   * to the log.
   * 
   * @param {string} filename the path to the tree to unlink from the node list
   */
  p.removeModule = function(filename) {
    fs.readFile(filename, (err, treeContents) => {
      // If an error occurred...
      if (err) {
        // If the error is not because the file does not exist...
        if (err.code != "ENOENT") {
          // Report the error.
          this.logger.error("Failed to open tree '" + filename + "': " + err);
        }
      } else {
        // Attempt to parse the file.
        try {
          var treeData = JSON.parse(treeContents);
        } catch (err) {
          // Report the error and abort.
          this.logger.error("Could not parse tree '" + filename + "': " + err);
          return;
        }

        this.removeNode(treeData.name);
      }
    });
  }
  /**
   * Finds a module with name `name` and returns the JSON data for it as well as its path, or `null` if no such module
   * exists. If no project is loaded, the method returns `null` without doing anything else.
   * 
   * @param {string} name the name of the module to find
   * @returns an object containing the `contents` of the module with name `name` and its `path`, or `null` if no such
   *   module exists
   */
  p.findModule = function(name) {
    // If this.project is not defined, abort, returning null.
    if (!this.project)
      return null;

    // If the project tree cache has expired or has not been created yet...
    if (this.projectTrees == undefined) {
      // Find all of the trees and store some information about them in memory.
      this.projectTrees = [];

      this.project.findTrees().forEach(treePath => {
        var treeData = this.loadJSON(treePath);

        // Skip the current tree if parsing fails.
        if (!treeData)
          return;

        // Remove root to save up on memory.
        treeData.root = undefined;

        this.projectTrees.push({contents: treeData, path: treePath});
      });

      var this_ = this;
      // Make the cache expire after a little bit of time.
      setTimeout(function() {
        this_.projectTrees = null;
      }, 20000)
    }

    // For each tree found within the directory containing the project file...
    for (var i = 0; i < this.projectTrees.length; i++) {
      var tree = this.projectTrees[i];
      var treeData = tree.contents;

      // If the name of the tree matches `name`...
      if (treeData.name === name) {
        return tree;  // Return the tree.
      }
    }

    return null;  // This value is returned if no trees matching `name` are found.
  }
  /**
   * Attempts to parse the JSON data in file `filename` and returns the result if successful. Otherwise, returns 
   * `undefined` and sends an error to log. This function fails if an I/O error occurs or the file's contents do not
   * represent valid JSON.
   * 
   * @param {string} filename the path to the JSON file to read
   * @returns the JSON parsed from the file, or `undefined` if an error occurred
   */
  p.loadJSON = function(filename) {
    // Attempt to load the file.
    try {
      var jsonContents = fs.readFileSync(filename);
    } catch (err) {  // If an error occurred...
      // Report it and abort processing this tree.
      this.logger.warn("Error while reading file '" + filename + "': " + err);
      return;
    }

    // Attempt to parse the file.
    try {
      var jsonData = JSON.parse(jsonContents);
    } catch (err) {  // If an error occurred...
      // Report it and abort processing this tree.
      this.logger.warn("Error while parsing file '" + filename + "': " + err);
      return;
    }

    return jsonData;
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

    editor.importFromJSON(data, filename);
  }

  /**
   * Returns an object containing a simplified representation of the block `block` and its children, located in tree 
   * `tree`. Also populates the array `scripts` with the scripts used by the block and its children.
   * 
   * @param {string} blockId the ID of the block to export
   * @param {Tree} tree the tree in which the block is located. 
   * @param {string[]} scripts the list of scripts to fill
   * @returns an external representation of the block and its children
   */
  p.exportBlock = function(blockId, tree, scripts) {
    var block = this.getBlockById(blockId, tree);

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
          data.children[i] = this.exportBlock(children[i], tree, scripts);
        }
      } else if (block.type == "decorator") {
        data.child = this.exportBlock(children[0], tree, scripts);
      }
    }

    return data;
  }

  /**
   * Returns a simplified representation of `tree`.
   * 
   * @param {Tree} tree the tree to export to JSON
   * @returns a simplified representation of the current tree
   */
  p.exportToJSON = function(tree) {
    var root = this.getRoot(tree);
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

    var rootBlock = root.getOutNodeIds()[0];

    if (rootBlock) {
      data.root = this.exportBlock(rootBlock, tree, data.scripts);
    } else {
      data.root = null;
    }

    return data;
  }

  /**
   * Returns a pretty-printed string containing the JSON data `treeData`.
   * 
   * @param {object} treeData the tree data to stringify
   * @returns a pretty-printed representation of `treeData`
   */
  p.stringifyTree = function(treeData) {
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

    return CustomJSON.stringify(treeData, replacer, 2);
  }

  /**
   * Asynchronously writes a tree to disk, logs that the tree was saved, shows a notification for it in the GUI, emits
   * the "treesaved" event for that tree, and synchronizes the node definition corresponding to the tree. Has no effect
   * if the tree does not have a defined path. If writing to the tree is unsuccessful, then an error is reported to the
   * log, and none of the actions that follow are triggered.
   * 
   * @param {b3editor.Tree} tree (optional) the tree to write to disk. Defaults to the currently selected tree.
   * @param {(boolean) => void} postWriteCallback (optional) the function to call after successfully writing to disk.
   *   Takes in a boolean signifying whether or not the writing was successful.
   */
  p.writeTreeFile = function(tree, postWriteCallback) {
    tree = tree || this.tree;
    postWriteCallback = postWriteCallback || function() {};  // Default to empty function

    var json = this.exportToJSON(tree);
    var path = tree.path;
    var editor = this;

    if (path != "") {
      fs.writeFile(path, this.stringifyTree(json), function(err){
        // If an error occurred...
        if (err) {
          // Report it and abort.
          editor.logger.error("Error while saving tree '" + path + "': " + err);
          postWriteCallback(false);

          return;
        }

        // Mark undo history as saved.
        tree.undoHistory.save();

        // Broadcast treesaved event (for filename directive).
        editor.trigger("treesaved", tree);

        // Update corresponding node definition
        editor.importModule(json, path, tree.nameSinceLastSave);

        // Update name of tree since last save.
        tree.nameSinceLastSave = tree.blocks[0].title;

        editor.logger.info("Saved tree "+name)
        editor.trigger('notification', name, {
          level: 'success',
          message: 'Saved'
        });

        postWriteCallback(true);
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
   * @param {(boolean) => void} postSaveCallback (optional) the function to call after saving. Takes in whether or not
   *   the writing was successful.
   */
  p.saveTree = function(useExistingPath, tree, postSaveCallback) {
    tree = tree || this.tree;
    postSaveCallback = postSaveCallback || function() {};  // Default to a no-args function that does nothing

    var path = tree.path;

    var editor = this;

    // Makes a unique name based on a baseName (that is, one that does not conflict with any node names or names of
    // opened trees) and returns it. More specifically, it finds the first number to append that does not result in a
    // conflict (extracting it if already provided).
    var makeUniqueName = function(baseName) {
      // Matches anything that ends with a dash followed by one or more digits. Also captures the part before it.
      const NUMBER_REGEXP = /(.+)-(\d+)$/;

      var match = NUMBER_REGEXP.exec(baseName);

      var trueBaseName, suffixNumber;

      // If base name contains a match...
      if (match != null) {
        // Get true base name and suffix number.
        trueBaseName = match[1];
        suffixNumber = parseInt(match[2]);
      } else {
        // Set true base name and suffix number manually.
        trueBaseName = baseName;
        suffixNumber = 1;
      }

      var newName;

      do {
        // Make new name, then increment suffix number.
        newName = trueBaseName + "-" + suffixNumber;
        suffixNumber++;
      }  // ...While the proposed name matches any existing tree or node names.
      while (editor.trees.some(tree => tree.blocks[0].title == newName) || editor.nodes[newName]);

      return newName;
    }

    // This is what actually tries to save the tree.
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

            // If we should not use an existing path (i.e., this is a "Save As..." dialogue)...
            if (!useExistingPath) {
              // Rename the root to be unique. Also unset the nameSinceLastSave attribute so that it doesn't rename the
              // old node.
              var root = editor.getRoot(tree);
              editor.editBlock(root, {
                title: makeUniqueName(root.title),
                description: root.description,
                properties: root.properties,
                output: root.output
              });
              tree.nameSinceLastSave = null;
            }

            editor.removeModule(filename);

            editor.writeTreeFile(tree, postSaveCallback);
          }
        });
      } else {
        editor.writeTreeFile(tree, postSaveCallback);
      }
    }

    // Show warning if the tree has invalid blocks.
    this.conditionalWarning({
      predicate: () => editor.hasInvalidBlocks(),
      message: "The tree '" + tree.blocks[0].title + "' contains node type conflicts. Are you sure you want to save?",
      choices: [
        {name: "Yes", triggersCallback: true},
        {name: "No", triggersCallback: false}
      ],
      conditionalCallback: saveTreeHelper
    });
  }
  p.loadProject = function(project) {
    var this_ = this;

    function loadProjectHelper() {
      this_.resetNodes();
      this_.trees = [];
      this_.addTree();

      // If a project is already loaded...
      if (this_.project) {
        try {
          // Save the project.
          fs.writeFileSync(this_.project.fileName, this_.project.save());
        } catch (err) {
          // Report error.
          this_.logger.error("Error occurred while saving project: " + err);
        }
      }

      // Actually load the project.
      this_.settings.set("last_project", project.fileName);
      this_.saveSettings();

      this_.logger.info("Loaded project from " + project.fileName);
      this_.project = project;

      this_.importAllNodes(project.findNodes());
      this_.pruneExportHierarchy();

      this_.logger.info("Successfully loaded project");
    }

    this.unsavedTreesWarning(() => {
      // Show warning if the editor has unsaved nodes after going through the unsaved trees.
      this_.conditionalWarning({
        predicate: () => !this_.nodeListIsSaved(),
        message: "Are you sure you want to load the project? If so, all unsaved nodes will be lost.",
        choices: [
          {name: "Yes", triggersCallback: true},
          {name: "No", triggersCallback: false}
        ],
        conditionalCallback: loadProjectHelper
      })
    });
  }
  /**
   * Returns the export data of nodes fitting a specific category `category` and directory of origin `origin`.
   * 
   * @param {string} category the category of nodes to export
   * @param {string} origin the directory of origin to filter by (a relative path)
   * @returns a list of nodes to export (keyed by name)
   */
  p.getNodeCategoryExportData = function(category, origin) {
    var data = {};
  
    for (var name in this.nodes) {
      var node = this.nodes[name];
      var nodeCategory = node.prototype.category || node.prototype.type
      if (nodeCategory == category && node.prototype.originDirectory == origin) {
        if (node.prototype.type != "root") {
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
          } else if (node.prototype.type == "module" && node.prototype.pathToTree != undefined) {
            // pathToTree is absolute here, so we make it relative to the save location.
            data[name].pathToTree = path.relative(path.resolve(this.project.fileName, origin), node.prototype.pathToTree);
          }
        }
      }
    }

    var exportData;

    // If the node is to be exported as a patch file...
    if (this.getNodesPatchMode(origin, category)) {
      exportData = this.nodesToPatch(data);
    } else {
      exportData = data;
    }

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
    return CustomJSON.stringify(exportData, replacer, 2);
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

  /**
   * Exports nodes based on an object `categoriesToExport` containing hash sets of categories to export each 
   * mapped to an origin directory.
   * 
   * @param {*} categoriesToExport the export hierarchy to use
   */
  p.exportNodes = function(categoriesToExport) {
    this.globalNodeUndoHistory.saveHierarchy(categoriesToExport);
    var nodes = this.getNodeExportData(categoriesToExport);
    for (var origin in nodes) {
      var nodesInDir = nodes[origin];
      for (var category in nodesInDir) {
        if (nodesInDir[category] !== null) {
          var saveLocation = path.join(path.resolve(this.project.fileName, origin), category + ".nodes");
          // Location of the file to delete (so that only the non-patch variant or the patch variant can exist)
          var otherSaveLocation;

          // If this file should be exported as a patch file...
          if (this.getNodesPatchMode(origin, category)) {
            otherSaveLocation = saveLocation;
            saveLocation += ".patch";
          } else {
            otherSaveLocation = saveLocation + ".patch";
          }

          fs.writeFile(saveLocation, nodesInDir[category], (err) => {
            // If an error was thrown...
            if (err)
              this.logger.error("Failed to export nodes at '" + saveLocation + "': " + err);
          });

          fs.unlink(otherSaveLocation, (err) => {
            // If an error was thrown and it was not because the file does not exist...
            if (err && err.code != "ENOENT") {
              this.logger.error("Failed to remove file '" + otherSaveLocation + "': " + err);
            }
          });
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
   * Sets whether or not a particular nodes file should be exported as a `.patch` file.
   * 
   * @param {string} originDirectory the save location of the list of nodes
   * @param {string} category the category / type of the node
   * @param {boolean} isPatch the patch mode to set (`true` for patch-nodes, `false` otherwise)
   */
  p.setNodesPatchMode = function(originDirectory, category, isPatch) {
    // If the origin directory is not registered in the set of patch-nodes...
    if (this.patchNodes[originDirectory] === undefined) {
      this.patchNodes[originDirectory] = {};
    }

    this.patchNodes[originDirectory][category] = isPatch;
  }

  /**
   * Returns whether or not the node list in save location `originDirectory` and category `category` is to be exported
   * as a patch file.
   * 
   * @param {string} originDirectory the save location of the list of nodes
   * @param {string} category the category / type of the node
   * @returns `true` if the node list in `originDirectory` of type `category` is to be exported as a patch file, `false`
   * otherwise
   */
  p.getNodesPatchMode = function(originDirectory, category) {
    var categoryPatchNodes = this.patchNodes[originDirectory];

    if (categoryPatchNodes !== undefined)
      return categoryPatchNodes[category];

    // Implicitly return undefined
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
  /**
   * Adds some nodes from the given JSON contents `json`, with information about the directory from which it was loaded 
   * `originDirectory` and `isCommand` to indicate whether or not this action should be considered an undoable command.
   * If `isPatch` is `true`, then the contents are translated into a list of nodes from the JSON patch format, and all
   * categories listed in the nodes file will be exported as .patch files.
   * 
   * @param {string} json the JSON contents of the .nodes / .nodes.patch file to import
   * @param {string} originDirectory the directory from which the file originated (absolute)
   * @param {boolean} isCommand whether or not this act of importing the nodes is to be considered a command
   * @param {boolean} isPatch (optional) whether or not the file being imported is a patch file.
   */
  p.importNodes = function(json, originDirectory, isCommand, isPatch) {
    // Handle parse error
    try {
      var nodes = JSON.parse(json);
    } catch (err) {
      // Log error and abort.
      this.logger.error("Error while parsing file: " + err);
      return;
    }

    // If the file is a patch file...
    if (isPatch) {
      nodes = this.nodesFromPatch(nodes);
    }

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
            originDirectory: nodeClass.prototype.originDirectory,
            category: nodeClass.prototype.category,
            type: nodeClass.prototype.type
          };
        });
        // Add the command (with an undefined ID).
        this.pushCommandNode(affectedGroups, 'ImportNodes', {nodes: nodesImported, isPatch});
      } else {  // Otherwise...
        // Add the nodes individually.
        nodesImported.forEach(node => this.addNode(node));

        if (isPatch) {
          nodesImported.forEach(node => 
            this.setNodesPatchMode(node.prototype.originDirectory, node.prototype.category || node.prototype.type, true)
          );
        } else {
          nodesImported.forEach(node => {
            var category = node.prototype.category || node.prototype.type;

            // Set anything undefined here to false.
            if (this.getNodesPatchMode(node.prototype.originDirectory, category) === undefined) {
              this.setNodesPatchMode(node.prototype.originDirectory, category, false);
            }
          });
        }
      }
    }
  }
  // Helper function. Shortcut for importing nodes during the loading of the project.
  // nodesPathList is the list of nodes paths to import (absolute).
  // originDirectory is the directory from which the list of nodes originated (absolute).
  p.importNodesInit = function(nodesPathList, originDirectory) {
    nodesPathList.forEach(file => {
      this.logger.info("Import nodes from " + path.relative(this.project.fileName, file));

      // Try to read the file.
      try {
        var json = fs.readFileSync(file);
      } catch (err) {
        // Report error and skip the current file.
        this.logger.error("Failed to read file: " + err);
        return;
      }
      
      this.importNodes(json, originDirectory, false, file.endsWith(".patch"));
    });
  }
  /**
   * Returns an object compatible with `importNodes` containing the nodes that were added by the patch list `patch`.
   * Entries that do not add a node are ignored.
   * 
   * @param {*} patch the JSON patch from which to get the nodes
   * @returns the nodes added by `patch`
   */
  p.nodesFromPatch = function(patch) {
    // Matches anything that consists solely of a slash followed by one or more non-slash characters.
    const TOP_LEVEL_REGEXP = /^\/([^\/]+)$/;

    var nodes = {};

    patch.forEach(op => {
      // If the operation "add"s something...
      if (op.op === "add") {
        var match = TOP_LEVEL_REGEXP.exec(op.path);

        // ...to the top-level object...
        if (match != null) {
          // Add the node to nodes (replacing ~0 with ~ and ~1 with /).
          nodes[match[1].replace("~0", "~").replace("~1", "/")] = op.value;
        }
      }
    });

    return nodes;
  }
  /**
   * Returns a JSON patch representation of `nodes`.
   * 
   * @param {*} nodes the node mapping to convert
   */
  p.nodesToPatch = function(nodes) {
    var patch = [];

    // For each node name and node value...
    for (var nodeName in nodes) {
      var node = nodes[nodeName];

      // Add the node to the patch (replacing ~ with ~0 and / with ~1).
      patch.push({op: "add", path: "/" + nodeName.replace("~", "~0").replace("/", "~1"), value: node});
    }

    return patch;
  }
  /**
   * Creates and returns a node class from a provided node definition `node` and the directory from which it originated
   * (if applicable) `originDirectory`. If the node is already registered or results in a type conflict, an error is
   * logged and the method returns `undefined`. If the node has type `module` and a defined `pathToTree` attribute that
   * is relative, then `originDirectory` must be defined for it to be converted into an absolute path, or an error will
   * occur.
   * 
   * @param {object} node the node definition to convert into a class
   * @param {string?} originDirectory (optional) the directory from which the node originated (either absolute or 
   *   relative to the project path)
   * @returns a node class, or `undefined` if the node is already registered or results in a type conflict
   */
  p.makeNode = function(node, originDirectory) {
    if (this.nodes[node.name]) {
      this.logger.error('Node named "'+node.name+'" already registered.');
      return;
    }

    // If the node has corresponding (unregistered) blocks that differ in type...
    if (this.hasMismatchedBlocks(node.name, node.type)) {
      // Report it and abort
      this.logger.error("Node type '" + node.type + "' conflicts with type of existing node. Hint: Did you input the" +
        " correct type?");
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

    // If a project is loaded and the origin directory is defined as a non-empty string...
    if (this.project && originDirectory) {
      // If the path is absolute...
      if (path.isAbsolute(originDirectory))
        // Display it relative to the project directory.
        tempClass.prototype.originDirectory = path.relative(this.project.fileName, originDirectory);
      else
        tempClass.prototype.originDirectory = originDirectory;
    } else
      tempClass.prototype.originDirectory = '';

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
    } else if (node.type == "module") {
      // If the module has a defined path to the tree (which may not be the case for older files)...
      if (node.pathToTree) {
        // If the path is absolute...
        if (path.isAbsolute(node.pathToTree))
          tempClass.prototype.pathToTree = node.pathToTree;
        else {
          // If the origin directory is not defined...
          if (originDirectory == undefined)
            // Throw an error and abort.
            throw new TypeError("originDirectory is not defined.");

          // Make the origin directory be absolute if necessary
          var absoluteDir;
          if (path.isAbsolute(originDirectory))
            absoluteDir = originDirectory;
          else
            absoluteDir = path.resolve(this.project.fileName, originDirectory);

          tempClass.prototype.pathToTree = path.resolve(absoluteDir, node.pathToTree);
        }
      } else {
        // Try to find the module.
        var moduleData = this.findModule(tempClass.prototype.name);
        // If found...
        if (moduleData) {
          tempClass.prototype.pathToTree = moduleData.path;
        } else {
          // Report the error.
          this.logger.warn("Could not find tree corresponding to node '" + tempClass.prototype.name + "'.");
        }
      }
    }

    return tempClass;
  }
  /**
   * Creates and adds a node to the editor via an undoable command. Returns the node that was added.
   * 
   * @param {object} node the node to add
   * @param {string} originDirectory the directory from which the node originated. Use empty string for none.
   * @returns the node class that was added
   */
  p.makeAndAddNode = function(node, originDirectory) {
    var nodeClass = this.makeNode(node, originDirectory);

    // If a node class was returned...
    if (nodeClass) {
      var affectedGroups = [{originDirectory, category: node.category, type: node.type}];
      // Push the command to the editor.
      this.pushCommandNode(affectedGroups, 'AddNode', {node: nodeClass});
    }

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
  /**
   * Attempts to edit a node with the original name `oldName` to have the attributes defined in `newNode`. If the node
   * with name `oldName` does not exist, then this method has no effect. If the new name set in `newNode` matches an
   * already existing node (not including the node with name `oldName`), then an error is sent to the log, and this
   * method has no further effect. This method also has no effect if `newNode` is identical to the node with name 
   * `oldName`.
   * 
   * @param {string} oldName the old name of the node
   * @param {b3editor.Action | b3editor.Composite | b3editor.Decorator | b3editor.Module} newNode the new properties of 
   * the node
   * @param {string} originDirectory the updated directory in which to save the node.
   * @param {boolean} isCommand whether or not the action should be counted as a command.
   */
  p.editNode = function(oldName, newNode, originDirectory, isCommand) {
    if (!this.nodes[oldName]) return;

    if (oldName !== newNode.name && this.nodes[newNode.name]) {
      this.logger.error('Node named "'+newNode.name+'" already registered.');
      return;
    }

    // If the nodes are identical and the old node has the same origin directory as provided...
    if (this.editedEqualsNode(oldName, newNode) && this.nodes[oldName].prototype.originDirectory === originDirectory)
      // Abort
      return;

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
  /**
   * Edits a node with the original name `oldName` to have the attributes defined in `newNode`. Required attributes:
   * `name`, `title`. Also sets the save location of the node to `originDirectory`.
   * 
   * Optional attributes: `properties`, `output` (required if the `type` of the original node is `action`), `pathToTree`
   * (required if the `type` of the original node is `module`), `category`, `script`.
   * 
   * @param {string} oldName the original name of the node
   * @param {b3editor.Action | b3editor.Composite | b3editor.Decorator | b3editor.Module} newNode the new node
   *     definition to use
   * @param {string} originDirectory the new save location to use
   */
  p.editNodeForce = function(oldName, newNode, originDirectory) {
    var node = this.nodes[oldName];

    var oldOriginDirectory = node.prototype.originDirectory;
    var oldCategory = node.prototype.category;

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
    } else if (node.prototype.type == "module") {
      node.prototype.pathToTree = newNode.pathToTree;
    }

    // Update the export hierarchy
    this.addToExportHierarchy(originDirectory, node.prototype.category || node.prototype.type);

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

    delete this.nodes[name];
    this.trigger('noderemoved', node);

    this.updateAllBlocks(name);
  }

  /**
   * Returns `true` if the edited node `node` is structurally equal to the node with name `name` in all attributes
   * (with `type` not being compared), `false` otherwise.
   * 
   * @param {string} name the name of the original node to compare
   * @param {object} node the edited node to compare
   * @returns `true` if `node` is the same as the node with name `name` (not including `type`), `false` otherwise.
   */
  p.editedEqualsNode = function(name, node) {

    // If either node is not defined...
    if (this.nodes[name] == undefined || node == undefined)
      return false;

    var otherNode = this.nodes[name].prototype;

    return (otherNode.name === node.name && otherNode.title === node.title
      && b3editor.jsonEquals(otherNode.properties, node.properties)
      && b3editor.jsonEquals(otherNode.output, node.output) && otherNode.category === node.category
      && otherNode.script === node.script && otherNode.pathToTree === node.pathToTree)
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
    if (filename) {
      tree.path = filename;  // Set the tree's path to it.
    }

    this.trees.push(tree);

    this.trigger('treeadded', tree);

    this.selectTree(tree.id);
    this.select(this.blocks[0]);
    this.center();
    this.canvas.stage.update();

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
  /**
   * Removes a tree with ID `id` and selects some other tree if the tree to remove is the currently selected one. If the
   * tree is unsaved, then a warning is shown to the user beforehand.
   * 
   * @param {string} id the ID of the tree to remove
   */
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
      var isUnsaved = this.conditionalWarning({
        predicate: () => !tree.undoHistory.isSaved(),
        conditionalCallback: removeTreeHelper,
        message: "Save changes to '" + tree.blocks[0].title + "' before closing?",
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

      // If the tree is unsaved...
      if (isUnsaved)
        // Show the tree that is unsaved.
        this.selectTree(tree.id);
    }
  }

  /**
   * Moves a tree with id `id` to index `idx`.
   * 
   * @precondition `0 <= idx <= this.trees.length`
   * @param {string} id the ID of the tree to move
   * @param {number} idx the new place to which to move the tree
   */
  p.moveTree = function(id, idx) {
    var oldIdx = -1;
    var treeToMove = null;

    // For each tree...
    for (var i = 0; i < this.trees.length; i++) {
      var tree = this.trees[i];
      // If the tree's ID matches the one given...
      if (tree.id === id) {
        oldIdx = i;  // set old index.
        treeToMove = tree;  // Set the tree to move.
        break;  // Break out of loop to stop the search.
      }
    }

    // If the tree is found...
    if (oldIdx != -1) {
      this.trees.splice(oldIdx, 1);  // Remove it from the list where it is...

      // Special case: oldIdx < idx (idx will have to be decremented because everything following oldIdx was shifted 
      // back by one).
      if (oldIdx < idx)
        idx--;

      this.trees.splice(idx, 0, treeToMove);  // And add it back at the right location.
    }

    this.trigger("treemoved");
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
    function unsavedNodesWarning(noCloseOnSavedNodes) {
      var hasUnsavedNodes = !this_.nodeListIsSaved();
      // If there are any unsaved nodes...
      if (hasUnsavedNodes) {
        // Asynchronous function. The function returned from onExit will have returned by the time the message box has 
        // opened.
        dialog.showMessageBox(remote.getCurrentWindow(), {
          message: "Are you sure you want to close the application? If so, all unsaved nodes will be lost.",
          type: "warning",
          buttons: ["Yes", "No"]
        }, function(result) {
          switch (result) {
            case 0:  // "Yes"
              // Close window.
              closeWindow();
              break;
            // "No" will do nothing.
          }
        });
      }  // Otherwise, if noCloseOnSavedNodes is false (i.e., we should close the window)...
      else if (!noCloseOnSavedNodes) {
        closeWindow();
      }

      return hasUnsavedNodes;
    }
    /**
     * Overview of function behavior: Performs two checks before closing the application: Whether all trees are saved 
     * and whether all nodes are saved. If either of them fail, then this function will block the application from 
     * closing and show a corresponding message box for each check that failed. The first message (or rather, series of 
     * messages) asks the user whether or not they want to save each unsaved tree, with a third option to "Cancel", or
     * stop the application from closing. Additional buttons for saving all of them or saving none of them may show up
     * too if more than one tree is unsaved. The second message asks the user if they want to close the application
     * despite some nodes being unsaved. Selecting "No" will stop the application from closing altogether. Due to the
     * used version of Electron not supporting synchronous calls to opening any form of dialog, recursion is necessary
     * to handle all of these cases.
     */
    return function(e) {
      // Make unsavedNodesWarning the postSaveCallback. Also get whether or not the editor has unsaved trees
      // so we can let Electron know not to close the program just yet. Do not call unsavedNodesWarning in this callback
      // as we want to use a different call for unsavedNodesWarning.
      var hasUnsavedTrees = this_.unsavedTreesWarning(unsavedNodesWarning, false);

      // If the editor has any unsaved trees or unsaved nodes (not force-closing if there are saved nodes)...
      if (hasUnsavedTrees || unsavedNodesWarning(true))
        e.returnValue = false;  // Arbitrary value. Prevents the window from closing at first.
      else
        this_.onApplicationClose();
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
   * @param {Tree?} tree (optional) the tree in which to add the command. Adds the command to the currently selected
   *   tree if not defined
   */
  p.pushCommandTree = function(cmd, args, fromPropertyPanel, tree) {
    tree = tree != undefined ? tree : this.tree;  // Default to current tree

    args.editor = this;

    // Look up the undo history corresponding to the current tree. 
    var undoHistory = tree.undoHistory;

    // Add the command with name `cmd` to that undo history.
    undoHistory.addCommand(new b3editor[cmd](args));

    // Emit a treesavestatuschanged event.
    this.trigger('treesavestatuschanged', tree, {isSaved: undoHistory.isSaved()});

    // If the call came from the property panel...
    if (fromPropertyPanel)
      this.trigger('changefocus', "right-panel");  // Set the focus to the property panel.
    else  // Otherwise...
      this.trigger('changefocus', "tree-editor");  // Set the focus to the tree editor.
  }
  /**
   * Adds a command with name `cmd` and arguments `args` to the `NodeUndoStack`, supplying `affectedGroups` to its 
   * `addCommand()` method, automatically supplying the `editor` argument as this current editor. 
   * 
   * @param {object[]} affectedGroups the affected groups to convert into a hash string
   * @param {string} affectedGroups[].originDirectory the origin directory to use, empty string for no origin directory
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
   * Returns `true` if the node list is considered to be saved, `false` otherwise. The node list is considered to be
   * saved if there are no unsaved export directories or the only unsaved export directory is "No Save Location" and it
   * is empty.
   */
  p.nodeListIsSaved = function() {
    var numUnsaved = this.globalNodeUndoHistory.numUnsavedDirs();

    // Return true if the number of unsaved directories is 0 or it is 1 and the "No Save Location" directory list is
    // unsaved but empty.
    return numUnsaved == 0 || (numUnsaved == 1 && !this.globalNodeUndoHistory.dirIsSaved("") && 
    this.noLocationNodeListIsEmpty())
  }

  /**
   * Returns `true` if the list of nodes with no save location is empty, `false` otherwise.
   */
  p.noLocationNodeListIsEmpty = function() {
    // For each node in the node list...
    for (var nodeName in this.nodes) {
      var node = this.nodes[nodeName];

      // If the node has the empty string as the origin directory...
      if (node.prototype.originDirectory == "")
        return false;  // Stop and return false.
    }

    // Return true here because there are no nodes with no save location.
    return true;
  }

  /**
   * Returns `true` if the list of nodes with no save location is saved or empty, `false` otherwise.
   */
  p.noLocationNodeListIsSaved = function() {
    return this.globalNodeUndoHistory.dirIsSaved("") || this.noLocationNodeListIsEmpty();
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
   * chooses to allow it to be called by selecting an option where `triggersCallback` is true.
   * @param {((result: integer) => void)?} args.dialogCallback (optional) the function to call when the dialog box is
   * shown.
   * @param {(() => void)?} args.conditionalDialogCallback (optional) the function to call if the user chooses it to 
   * allow it to be called. `args.conditionalCallback` is used instead if this parameter is not defined.
   * @returns whether or not `args.predicate` returned true.
   */
  p.conditionalWarning = function(args) {
    var predicateMet = args.predicate();
  
    // If the predicate returns true...
    if (predicateMet) {
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

    return predicateMet;
  }

  /**
   * Asks the user through dialog boxes whether or not they want to save each unsaved tree. For exactly one unsaved 
   * tree, the options include "Yes" (to save the tree), "No" (not to save the tree), or "Cancel" (cancel whatever 
   * operation causes the tree to be lost). For more than one tree, a series of dialog boxes are shown that include the
   * options "Yes to All" (save all trees) and "No to All" (save none of the trees) in addition to "Yes", "No", and 
   * "Cancel".
   * 
   * All dialog boxes are handled asynchronously. For this reason, an argument `postSaveCallback` is included to be
   * called when the user has navigated through the series of dialog boxes without clicking "Cancel" at any point.
   * `postSaveCallback` will also be called if no dialog boxes are shown. For further handling, the method also returns
   * whether or not at least one unsaved tree has been found.
   * 
   * @param {() => void} postSaveCallback the function to call after the dialog is shown, or right before it returns if
   *   no dialog is shown and `callbackOnSavedTrees` is true
   * @param {bool?} callbackOnSavedTrees whether or not `postSaveCallback` should be called if there are no unsaved 
   *   trees. Defaults to true.
   * @returns whether or not there is at least one unsaved tree
   */
  p.unsavedTreesWarning = function(postSaveCallback, callbackOnSavedTrees) {
    var this_ = this;

    // Use old callbackOnSavedTrees if defined. Use true otherwise.
    callbackOnSavedTrees = callbackOnSavedTrees != undefined ? callbackOnSavedTrees : true;

    // Returns a no-args function that saves all trees in `trees` starting from `i`, one by one, and then invokes the
    // post-save callback.
    function saveTreesGen(trees, i) {
      return function() {
        // If the number of remaining trees to save is 0 (base case)...
        if (i === trees.length)
          postSaveCallback();
        else  // Otherwise...
          this_.saveTree(true, trees[i], saveTreesGen(trees, i + 1));
      }
    }
    // Curried to make it so that this function can be given the arguments to be actually called later. This function 
    // shows a warning assuming that there is at least one unsaved tree.
    function unsavedTreesWarningHelperGen(unsavedTrees, i) {
      return function() {
        // Show the unsaved tree.
        this_.selectTree(unsavedTrees[i].id);
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
                // Save the tree, then invoke the post-save callback.
                this_.saveTree(true, unsavedTrees[i], postSaveCallback);
                break;
              case 1:  // No
                postSaveCallback();
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
                // Invoke post-save callback.
                postSaveCallback();
                break;
              // Cancel does nothing
            }
          })
        }
      }
    }

    var unsavedTrees = this.findUnsavedTrees();
    var hasUnsavedTrees;

    // If at least one unsaved tree exists...
    if (unsavedTrees.length > 0) {
      // Begin warning chain.
      unsavedTreesWarningHelperGen(unsavedTrees, 0)();
      hasUnsavedTrees = true;
    }  // Otherwise...
    else {
      // If postSaveCallback should be called when there are no unsaved trees...
      if (callbackOnSavedTrees)
        postSaveCallback();
      hasUnsavedTrees = false;
    }

    return hasUnsavedTrees;
  }
  // ==========================================================================

  // NOTIFICATION UTILITY =====================================================
  /**
   * Helper method. Generates a function to use for sending notifications at various levels.
   * 
   * @param {string} level the level of the notification
   * @returns a function that, when called, shows a notification with level `level` and a message constructed from 
   * formatting the first argument using the remaining arguments.
   */
  p.__notifyGen = function(level) {
    return function() {
      var formatString = arguments[0];

      // arguments doesn't have a slice method, so building the list manually is necessary.
      var formatArgs = [];
      for (var i = 1; i < arguments.length; i++)
        formatArgs.push(arguments[i]);

      // Construct the formatted message.
      var message = formatString.format.apply(formatString, formatArgs);

      // Send notification. NOTE: `this` is assumed to be the current editor here.
      this.trigger("notification", undefined, {level, message});
    }
  }

  /**
   * Sends a notification with level `info` containing message `msg`, with the remaining arguments being used as format
   * arguments.
   * 
   * @param {string} msg the message to send
   * @param {*} ...args the format arguments to put into `msg`
   */
  p.notifyInfo = p.__notifyGen("info");

  /**
   * Sends a notification with level `success` containing message `msg`, with the remaining arguments being used as
   * format arguments.
   * 
   * @param {string} msg the message to send
   * @param {*} ...args the format arguments to put into `msg`
   */
  p.notifySuccess = p.__notifyGen("success");

  /**
   * Sends a notification with level `warning` containing message `msg`, with the remaining arguments being used as
   * format arguments.
   * 
   * @param {string} msg the message to send
   * @param {*} ...args the format arguments to put into `msg`
   */
  p.notifyWarning = p.__notifyGen("warning");

  /**
   * Sends a notification with level `error` containing message `msg`, with the remaining arguments being used as format
   * arguments.
   * 
   * @param {string} msg the message to send
   * @param {*} ...args the format arguments to put into `msg`
   */
  p.notifyError = p.__notifyGen("error");


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
    return this.organizer.organize(this.getRoot(this.tree), orderByIndex);
  }
  p.collapseAll = function() {
    this.trigger("collapseall");
  }
  p.expandAll = function() {
    this.trigger("expandall");
  }
  p.reset = function() {
    // Remove all trees
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
  /**
   * Registers a connection (which has its `inBlock` and `outBlock` fields fully defined) into the editor.
   * @param {b3editor.Connection} connection the connection to add.
   * @param {boolean} shouldRender whether or not the connection should be rendered (in case something will be done that
   * requires re-rendering anyways). `true` by default.
   */
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
  /**
   * Creates and adds a connection.
   * 
   * @param {b3editor.Block} inBlock the starting block to use
   * @param {b3editor.Block} outBlock the ending block to use
   * @param {boolean} shouldRender whether or not the connection should be rendered (in case something will be done that 
   * requires re-rendering anyways). `true` by default.
   * @returns the created `Connection`
   */
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
  /**
   * Removes `connection` from the editor. The original `connection` remains unmodified.
   * 
   * @param {b3editor.Connection} connection the connection to remove
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
      case "left-panel":  // The node / tree panel
        this.trigger('nodesavestatuschanged');
        break;
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

  // ==========================================================================

  b3editor.Editor = Editor;
}());