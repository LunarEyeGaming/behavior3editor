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
  // node is the node to register
  p.registerNode = function(node) {
    // TODO: raise error if node is invalid
    var name = node.prototype.name;
    this.nodes[name] = node;

    var category = node.prototype.category
    if (category) {
      this.categories[category] = true;
    }

    // TODO: make a less dumb way of representing origin directories.
    var origin = node.prototype.originDirectory;
    if (origin) {
      this.originDirectories[origin] = true;
    }
  }

  p.resetNodes = function() {
    this.nodes = {};
    this.categories = {};
    this.originDirectories = {};
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
    block.properties = {};
    var proto = this.nodes[node.name].prototype;
    for (var key in proto.properties) {
      if (node.parameters[key] !== undefined) {
        block.properties[key] = JSON.parse(JSON.stringify(node.parameters[key]))
      } else {
        block.properties[key] = {value: null}
      }
      block.properties[key].type = proto.properties[key].type
    }

    if (node.type == 'action') {
      block.output = {};
      node.output = node.output || {};
      for (var key in proto.output) {
        block.output[key] = {type: proto.output[key].type, key: node.output[key] || null}
      }
    }

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
    var data = JSON.parse(json);
    this.logger.info("Import tree "+data.name);
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
    this.addConnection(root, dataRoot);

    var editor = this
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
      this.addNode(newNode);
    }

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
    this.importAllNodes(project.fileName, project.findNodes());
    this.pruneExportHierarchy();

    this.reset();

    // project.findTrees().forEach(file => {
    //   this.openTreeFile(file);
    // });

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
    if (this.project == null) {
      this.trigger('notification', name, {
        level: 'error',
        message: 'Cannot export nodes. No project loaded.'
      });
    }
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
    // // If the project has some nodes to export configured, use them instead.
    // if (this.project.nodesToExport) {
    //   return this.project.nodesToExport;
    // }

    // this.project.nodesToExport = {};

    // var hierarchy = this.project.nodesToExport;

    // // Go through each node...
    // for (var nodeName in this.nodes) {
    //   var node = this.nodes[nodeName];
    //   var originDirectory = node.prototype.originDirectory;

    //   // Skip if the origin directory or category is undefined (as is the case for the root node). It's also undesirable
    //   // to display undefined categories and origin directories like that.
    //   if (originDirectory === undefined || node.prototype.category === undefined) {
    //     continue;
    //   }

    //   // If hierarchy does not contain an entry for the originDirectory...
    //   if (hierarchy[originDirectory] === undefined) {
    //     hierarchy[originDirectory] = {}
    //   }

    //   // If the category is not included in the originDirectory entry...
    //   if (hierarchy[originDirectory][node.prototype.category] === undefined) {
    //     hierarchy[originDirectory][node.prototype.category] = true
    //   }
    // }

    // return hierarchy
  }
  // Adds a node with `originDirectory` and `category` to the export hierarchy, increasing an internal counter 
  // corresponding to that `originDirectory` and `category`.
  p.addToExportHierarchy = function(originDirectory, category) {
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
      console.log(originDirectory);
      // If no corresponding entry exists in the exportCounter...
      if (!this.exportCounter[originDirectory]) {
        delete this.project.nodesToExport[originDirectory];
      } else {  // Otherwise...
        // For each category in the export hierarchy for originDirectory...
        for (var category in this.project.nodesToExport[originDirectory]) {
          console.log(category);
          // If no corresponding entry exists in the exportCounter...
          if (!this.exportCounter[originDirectory][category]) {
            delete this.project.nodesToExport[originDirectory][category];
          }
        }
      }
    }
  }
  // json is the JSON contents of the .nodes file; originDirectory is the directory from which it originated.
  p.importNodes = function(json, originDirectory) {
    var nodes = JSON.parse(json);
    for (var name in nodes) {
      var node = nodes[name];

      this.addNode(node, originDirectory);
    }
  }
  // Helper function. Shortcut for importing nodes during the loading of the project.
  // projectLoc is the location of the behavior-project file to log the location of nodes that are imported.
  // nodesPathList is the list of nodes paths to import.
  // originDirectory is the directory from which the list of nodes originated (absolute).
  p.importNodesInit = function(projectLoc, nodesPathList, originDirectory) {
    nodesPathList.forEach(file => {
      this.logger.info("Import nodes from " + path.relative(projectLoc, file));
      var json = fs.readFileSync(file);
      this.importNodes(json, path.relative(projectLoc, originDirectory));
    });
  }
  // node is the node to add; originDirectory is the directory from which it originated (relative).
  p.addNode = function(node, originDirectory) {
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

    // Indicate the directory of origin
    tempClass.prototype.originDirectory = originDirectory;

    if (node.type == "action") {
      var category = node.category || '';

      // Update the export hierarchy
      this.addToExportHierarchy(originDirectory, category);

      tempClass.prototype.category = category;
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

    this.registerNode(tempClass);
    this.trigger('nodeadded', tempClass);
  }
  // Imports all nodes nodesPaths from the result of Project.findNodes().
  // nodesPaths is an object containing a mainPath, a mainNodes, and a nodesAssoc field. The nodesAssoc field contains
  // an association list that associates each nodes directory with a list of .nodes files to import.
  p.importAllNodes = function(projectLoc, nodesPaths) {
    this.importNodesInit(projectLoc, nodesPaths.mainNodes, nodesPaths.mainPath);
    nodesPaths.otherNodes.forEach(nodesAssoc => {
      var [nodesDir, nodesPathList] = nodesAssoc;
      this.importNodesInit(projectLoc, nodesPathList, nodesDir);
    })
  }
  // originDirectory is the updated directory in which to save the node.
  p.editNode = function(oldName, newNode, originDirectory) {
    var node = this.nodes[oldName];
    if (!node) return;

    if (oldName !== newNode.name && this.nodes[newNode.name]) {
      this.logger.error('Node named "'+newNode.name+'" already registered.');
      return;
    }

    // Remove the node from the export hierarchy.
    this.removeFromExportHierarchy(this.nodes[oldName].prototype.originDirectory, 
      this.nodes[oldName].prototype.category);

    delete this.nodes[oldName];
    this.nodes[newNode.name] = node;

    var oldTitle = node.prototype.title;
    node.prototype.name = newNode.name;
    node.prototype.title = newNode.title;
    node.prototype.originDirectory = originDirectory;
    if (newNode.properties)
      node.prototype.properties = JSON.parse(JSON.stringify(newNode.properties));
    if (node.prototype.type == "action") {
      // Update the export hierarchy
      this.addToExportHierarchy(originDirectory, node.prototype.category);

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

    this.trigger('nodechanged', node);
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

    // Remove from the export hierarchy.
    this.removeFromExportHierarchy(this.nodes[name].prototype.originDirectory, this.nodes[name].prototype.category);
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
      fs.writeFileSync(this_.project.fileName, this_.project.save());
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