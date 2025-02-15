angular.module('app.node', ['app.modal'])

//
// NODE CONTROLLER
//
.controller('NodeController', function($scope, $rootScope, $window, $timeout, ModalService, SearchHighlightFactory) {
  var this_ = this;

  // SCOPE --------------------------------------------------------------------
  $scope.types = ['composite', 'decorator', 'action', 'module'];
  $scope.nodes = {};
  $scope.categories = {};
  $scope.searchInfo = SearchHighlightFactory;

  $scope.showAddNodeModal = function(originDirectory, type, category) {
    ModalService.showModal({
      templateUrl: "app/node/modal-addnode.html",
      controller: 'AddNodeModalController',
      inputs: {'originDirectory': originDirectory, 'type': type, 'category': category}
    }).then(function(modal) {
      modal.close.then(function(result) {
      });
    });
  };

  $scope.showExportNodesModal = function() {
    ModalService.showModal({
      templateUrl: "app/node/modal-exportnodes.html",
      controller: 'ExportNodesModalController'
    }).then(function(modal) {
      modal.close.then(function(result) {
      });
    });
  };

  $scope.showEditNodeModal = function(node) {
    ModalService.showModal({
      templateUrl: "app/node/modal-editnode.html",
      controller: 'EditNodeModalController',
      inputs: {'node': node}
    }).then(function(modal) {
      modal.close.then(function(result) {});
    });
  };

  $scope.canEditNode = function(name) {
    return !$window.b3[name];
  }

  $scope.getTitle = function(node) {
    var title = node.prototype.title || node.prototype.name;
    title = title.replace(/(<\w+>)/g, function(match, key) { return '@'; });
    return title;
  }

  /**
   * Returns whether or not a project is loaded in the editor.
   * 
   * @returns true if a project is loaded, false otherwise.
   */
  $scope.projectLoaded = function() {
    return $window.app.editor.project != null;
  }

  /**
   * Returns whether or not the directory `dirName` should be marked as part of the project's auto-importing system as a
   * truthy or falsy value. If no project is loaded, returns a falsy value instead.
   * 
   * @param {string} dirName the name of the directory
   * @returns truthy if the directory is not undefined and is not in the project (when the project is defined), falsy
   *   otherwise
   */
  $scope.isNotInProject = function(dirName) {
    var project = $window.app.editor.project;

    // Should return true if containsDir returns false, unless dirName is "" or no project is loaded, in which case it
    // should return false.
    return project && dirName != '' && !project.containsDir(dirName);
  }

  /**
   * Adds a directory `dirName` to the project's auto-importing system. The programmer must ensure that this function is
   * never called when no project is loaded or `dirName` is already in the auto-importing system.
   * 
   * @param {string} dirName the name of the directory to add
   */
  $scope.addToProject = function(dirName) {
    $window.app.editor.project.addDir(dirName);
  }

  /**
   * Removes a directory `dirName` from the project's auto-importing system. The programmer must ensure that this
   * function is never called when no project is loaded.
   * 
   * @param {string} dirName the name of the directory to remove
   */
  $scope.removeFromProject = function(dirName) {
    $window.app.editor.project.removeDir(dirName);
  }

  /**
   * Returns whether or not the node group corresponding to `dirName` and `category` is to be exported as a patch file.
   * 
   * @param {string} dirName the name of the target save location
   * @param {string} category the name of the target category
   */
  $scope.getPatchMode = function(dirName, category) {
    return $window.app.editor.getNodesPatchMode(dirName, category);
  }

  /**
   * Toggles whether or not the node group corresponding to `dirName` and `category` should be exported as a patch file.
   * 
   * @param {string} dirName the name of the target save location
   * @param {string} category the name of the target category
   */
  $scope.togglePatchMode = function(dirName, category) {
    $window.app.editor.pushCommandNode([{originDirectory: dirName, category}], 'TogglePatchMode', {dirName, category});
  }

  /**
   * Returns a truthy or falsy value depending on whether or not a project is loaded, the directory `dirName` is not
   * `"undefined"`, and the project allows a directory to be removed (if `isRemoveButton` is true). This function 
   * represents whether or not a corresponding auto-import button should be displayed for the directory.
   * 
   * @param {string} dirName the name of the directory to check
   * @param {boolean} isRemoveButton whether or not the button is a remove button
   * @returns truthy if a corresponding button should be displayed for the directory, falsy otherwise
   */
  $scope.dirHasButton = function(dirName, isRemoveButton) {
    var project = $window.app.editor.project;

    // A directory displayed can have a button only if a project is loaded, the directory is not "", and the project
    // allows a directory to be removed or the button will not remove a directory.
    return project && dirName != '' && (!isRemoveButton || project.canRemoveDir());
  }

  /**
   * Returns whether or not all nodes in directory `dirName` are saved. If `dirName` is the empty string, then this 
   * function instead returns `true` if the list of nodes in `dirName` is empty.
   * 
   * @param {string} dirName the save location to check
   * @returns `true` if all nodes in directory `dirName` are saved, `false` otherwise
   */
  $scope.dirIsSaved = function(dirName) {
    return (dirName === "" && $window.app.editor.noLocationNodeListIsSaved())
    || $window.app.editor.globalNodeUndoHistory.dirIsSaved(dirName);
  }

  /**
   * Returns whether or not the nodes of type `typeName` in save location `dirName` are saved. If `dirName` is the empty
   * string (i.e., no save location), then this function also returns `true` if the list of nodes corresponding to 
   * `typeName` is empty
   * 
   * @param {string} dirName the save location in which to check
   * @param {string} typeName the name of the type to check
   * @returns `true` if the nodes of type `typeName` in save location `dirName` are saved, or `dirName === ""` and the 
   * list corresponding to `typeName` is empty, `false` otherwise
   */
  $scope.typeIsSaved = function(dirName, typeName) {
    return (dirName === "" && $scope.nodes[dirName][typeName].length === 0)
    || $window.app.editor.globalNodeUndoHistory.typeIsSaved(dirName, typeName);
  }

  /**
   * Returns whether or not all nodes of category `category` in save location `dirName` are saved.
   * 
   * @param {string} dirName the save location in which to check
   * @param {string} category the category to check
   * @returns `true` if all nodes of category `category` in save location `dirName` are saved, `false` otherwise
   */
  $scope.categoryIsSaved = function(dirName, category) {
    return (dirName === "" && $scope.nodes[dirName].actionCategories[category].length === 0)
    || $window.app.editor.globalNodeUndoHistory.categoryIsSaved(dirName, category);
  }

  /**
   * Returns whether or not the mapping of action categories to node lists is empty.
   * @param {*} nodesInDir the nodes in the directory
   * @returns whether or not the mapping of action categories to node lists is empty.
   */
  $scope.actionCategoriesEmpty = function(nodesInDir) {
    return Object.keys(nodesInDir.actionCategories).length === 0;
  }
  // --------------------------------------------------------------------------

  // UPDATE NODES VIEW --------------------------------------------------------
  this.updateNodesView = function() {
    // Updates $scope.nodes (the nodes view) to match this.nodes.
    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = this_.nodes;
        $scope.updateFilter();
      });
    }, 0, false);
  }
  // --------------------------------------------------------------------------

  // RESET NODES --------------------------------------------------------------
  this.resetNodes = function() {
    this.nodes = {};
    var editorNodes = $window.app.editor.nodes;

    // For each node in the editor's nodes...
    for (nodeName in editorNodes) {
      // If the node's name is "Root"...
      if (nodeName == "Root")
        continue;

      var node = editorNodes[nodeName];

      // If the origin directory has no corresponding entry, create it. Otherwise, do nothing.
      if (this.nodes[node.prototype.originDirectory] === undefined) {
        this.nodes[node.prototype.originDirectory] = {
          'composite'        : [],
          'decorator'        : [],
          'action'           : [],
          'module'           : [],
          'actionCategories' : {}  // Used to display nodes by category
        };
      }

      var guiNodesInDir = this.nodes[node.prototype.originDirectory];

      // If the type of node is valid and cannot overwrite "actionCategories" (which is reserved)...
      if (node.prototype.type !== "actionCategories" && guiNodesInDir[node.prototype.type])
        guiNodesInDir[node.prototype.type].push(node);

      var categoryNodes = guiNodesInDir.actionCategories;

      // If the node is an action...
      if (node.prototype.type == 'action') {
        // If the action category list for the corresponding category is undefined...
        if (!categoryNodes[node.prototype.category])
          // Define it.
          categoryNodes[node.prototype.category] = [];

        // Add node to action category list.
        categoryNodes[node.prototype.category].push(node);
      }
    }
  }
  // --------------------------------------------------------------------------

  // ADD NODE -----------------------------------------------------------------
  /**
   * Adds a node `node` to the node display list.
   * 
   * @param {b3editor.Action | b3editor.Composite | b3editor.Decorator | b3editor.Module} node the node to add
   */
  this.addNode = function(node) {
    // If the origin directory has no corresponding entry, create it. Otherwise, do nothing.
    if (this.nodes[node.prototype.originDirectory] === undefined) {
      this.nodes[node.prototype.originDirectory] = {
        'composite'        : [],
        'decorator'        : [],
        'action'           : [],
        'module'           : [],
        'actionCategories' : {}  // Used to display nodes by category
      };
    }

    var guiNodesInDir = this.nodes[node.prototype.originDirectory];

    // If the type of node is valid and cannot overwrite "actionCategories" (which is reserved)...
    if (node.prototype.type !== "actionCategories" && guiNodesInDir[node.prototype.type])
      guiNodesInDir[node.prototype.type].push(node);

    var categoryNodes = guiNodesInDir.actionCategories;

    // If the node is an action...
    if (node.prototype.type == 'action') {
      // If the action category list for the corresponding category is undefined...
      if (!categoryNodes[node.prototype.category])
        // Define it.
        categoryNodes[node.prototype.category] = [];

      // Add node to action category list.
      categoryNodes[node.prototype.category].push(node);
    }
  }
  // --------------------------------------------------------------------------

  // REMOVE NODE --------------------------------------------------------------
  /**
   * Removes a node from the node display list, optionally using an `originDirectory` and `category` as a target.
   * 
   * @param {b3editor.Composite | b3editor.Action | b3editor.Decorator | b3editor.Module} node the node to remove
   * @param {string?} originDirectory the directory from which to remove `node`. Defaults to `node`'s `originDirectory`
   * @param {string?} category the category from which to remove `node`. Defaults to `node`'s `category`
   */
  this.removeNode = function(node, originDirectory, category) {
    originDirectory = originDirectory !== undefined ? originDirectory : node.prototype.originDirectory;
    category = category !== undefined ? category : node.prototype.category;

    var guiNodesInDir = this.nodes[originDirectory];

    // If the type of node is valid and cannot overwrite "actionCategories" (which is reserved)...
    if (node.prototype.type !== "actionCategories" && guiNodesInDir[node.prototype.type]) {
      // Find the node.
      var nodeIdx = guiNodesInDir[node.prototype.type].indexOf(node);

      // If found...
      if (nodeIdx != -1)
        // Remove it.
        guiNodesInDir[node.prototype.type].splice(nodeIdx, 1);
    }

    var categoryNodes = guiNodesInDir.actionCategories;

    // If the node is an action...
    if (node.prototype.type == 'action') {
      // Find the node.
      var nodeIdx = categoryNodes[category].indexOf(node);

      // If found...
      if (nodeIdx != -1)
        // Remove it.
        categoryNodes[category].splice(nodeIdx, 1);
    }
  }
  // --------------------------------------------------------------------------

  // EDIT NODE ----------------------------------------------------------------
  /**
   * Moves a node `node` from the location identified by `oldOriginDirectory` and `oldCategory` to the new location
   * identified by `node`.
   * 
   * @param {b3editor.Action | b3editor.Composite | b3editor.Decorator | b3editor.Module} node the node to edit
   * @param {string} oldOriginDirectory the origin directory in which the node was originally located
   * @param {string} oldCategory the category in which the node was originally located
   */
  this.editNode = function(node, oldOriginDirectory, oldCategory) {
    this.removeNode(node, oldOriginDirectory, oldCategory);
    this.addNode(node);
  }
  // --------------------------------------------------------------------------

  // ON BUTTON "EXPORT NODES" -------------------------------------------------
  this.onButtonExportNodes = function() {
    if ($window.app.editor.project == null) {
      $window.app.editor.notifyError("Cannot export nodes. No project loaded.");
    } else {
      $scope.showExportNodesModal();
    }
  }
  // --------------------------------------------------------------------------

  // SEARCH FUNCTIONALITY ------------------------------------------------------
  $scope.searchByName = function(node) {
    if ($scope.searchInfo.searchText !== undefined)
      return $scope.getTitle(node).toLowerCase().includes($scope.searchInfo.searchText.toLowerCase());
    return true;
  }

  $scope.updateFilter = function() {
    var filteredNodes = {};

    // For each origin directory in the list of nodes...
    for (var originDirectory in $scope.nodes) {
      var nodesInDir = $scope.nodes[originDirectory];

      filteredNodes[originDirectory] = {
        "action": [],
        "composite": [],
        "decorator": [],
        "module": [],
        "actionCategories": {}
      };

      // For each node type...
      ["action", "composite", "decorator", "module"].forEach(type => {
        // For each node...
        nodesInDir[type].forEach(node => {
          // If the node matches the search filter...
          if ($scope.searchByName(node)) {
            // Add node to the hierarchy.
            filteredNodes[originDirectory][type].push(node);

            // If the node is an action...
            if (node.prototype.type == 'action') {
              var categoryNodes = filteredNodes[originDirectory].actionCategories;

              // If the action category list for the corresponding category is undefined...
              if (!categoryNodes[node.prototype.category])
                // Define it.
                categoryNodes[node.prototype.category] = [];

              // Add node to action category list.
              categoryNodes[node.prototype.category].push(node);
            }
          }
        });
      });
    }

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.filteredNodes = filteredNodes;
      });
    }, 0, false);
  }
  // --------------------------------------------------------------------------

  // REGISTER EVENTS ----------------------------------------------------------
  $window.app.editor.on('nodeadded', function(e) {
    this.addNode(e._target);
    this.updateNodesView();
  }, this);
  $window.app.editor.on('noderemoved', function(e) {
    this.removeNode(e._target);
    this.updateNodesView();
  }, this);
  $window.app.editor.on('nodechanged', function(e) {
    this.editNode(e._target, e.oldOriginDirectory, e.oldCategory);
    this.updateNodesView();
  }, this);
  $window.app.editor.on('nodesreset', function() {
    this.resetNodes();
    this.updateNodesView();
  }, this);
  $window.app.editor.on('nodesavestatuschanged', function() {
    this.updateNodesView();
  }, this);
  $rootScope.$on('onButtonNewNode', function() {$scope.showAddNodeModal()});
  $rootScope.$on('onButtonExportNodes', this.onButtonExportNodes);
  // --------------------------------------------------------------------------

  // INITIALIZE ELEMENTS ------------------------------------------------------
  this.resetNodes();
  this.updateNodesView();
  // --------------------------------------------------------------------------
})


// TODO: The add node and edit node modals are in need of massive cleanup.
//
// ADD NODE MODAL CONTROLLER
//
.controller('AddNodeModalController', function($scope, $window, $compile, $timeout, close, originDirectory, type, category) {
  $scope.close = function(result) { close(result); };

  $scope.originDirectory = originDirectory;
  $scope.inputNodeType = type;
  $scope.nodeType = $scope.inputNodeType;
  $scope.category = category;
  $scope.projectLoaded = $window.app.editor.project != null;

  // DYNAMIC TABLE ------------------------------------------------------------

  $scope.types = ['composite', 'decorator', 'action', 'module'];
  $scope.valueTypes = [
    {id: 'json', name: 'json'},
    {id: "entity", name: "entity"},
    {id: "position", name: "position"},
    {id: "vec2", name: "vec2"},
    {id: "number", name: "number"},
    {id: "bool", name: "bool"},
    {id: "list", name: "list"},
    {id: "table", name: "table"},
    {id: "string", name: "string"}
  ];
  // Note: this variable also defines the directory selection modes to display.
  $scope.dirModeDisplayText = {
    existing: "Use existing save location",
    new: "Use new save location",
    none: "Use no save location"
  };
  $scope.defaultDirMode = "existing";
  $scope.selectedDirMode = $scope.defaultDirMode;
  $scope.directories = $window.app.editor.getOriginDirectories();

  this.propertyTemplate = '\
    <tr>\
      <td><b3-property editable="true" is-output="{0}"><b3-property></td>\
      <td><a href="#" propertyremovable class="button alert right" title="Remove {1}">-</a></td>\
    </tr>\
  ';

  this.treeModuleParameters = function(treeParameters) {
    var params = {}
    for (var key in treeParameters) {
      params[key] = {
        type: 'json',
        value: treeParameters[key]
      }
    }
    return params
  }

  /**
   * Tries to read and parse the file at path `path` and checks if the name matches the provided name `name`. If not,
   * then sets `$scope.errorMessage` to contain the reason why it failed and returns `undefined`. Otherwise, returns the
   * JSON contents of the tree.
   * @param {string} path the path to the tree to read
   * @param {string} name the expected name of the tree
   * @returns the JSON contents of the tree, or `undefined` if unable to get the tree or the name of the tree does not 
   *   match `name`.
   */
  this.readTree = function(path, name) {
    // Try to read the tree.
    try {
      var contents = fs.readFileSync(path);
    } catch (err) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Cannot read file: " + err;
      });

      return;
    }

    // Try to parse the contents.
    try {
      var parsed = JSON.parse(contents);
    } catch (err) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Cannot parse file: " + err;
      });

      return;
    }

    // If the name of the tree does not match the current name...
    if (parsed.name != name) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Invalid tree: Tree name is '" + parsed.name + "' when it should be '" + name + "'.";
      });

      return;
    }

    return parsed;
  }

  var this_ = this;

  $scope.addProperty = function() {
    var template = this_.propertyTemplate.format("", "Property");
    var propertiesTable = angular.element(
      document.querySelectorAll('#addnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.addOutput = function() {
    var template = this_.propertyTemplate.format("a", "Output");
    var outputTable = angular.element(
      document.querySelectorAll('#addnode-output-table>tbody')
    );
    outputTable.append($compile(template)($scope));
  }

  $scope.changeType = function() {
    var domTreeLocation = angular.element(document.querySelector('#addnode-tree-location'));
    var domAddProperty = angular.element(document.querySelector('#addnode-addproperty'));
    var outputTable = angular.element(document.querySelector('#addnode-output'));
    var categoryRow = angular.element(document.querySelector('#addnode-script'));
    var scriptRow = angular.element(document.querySelector('#addnode-category'));
    var domType = document.querySelector('#addnode-modal #type');

    if (domType.value == 'action') {
      outputTable.css('display', 'block');
      categoryRow.css('display', 'block');
      scriptRow.css('display', 'block');
    } else {
      outputTable.css('display', 'none');
      categoryRow.css('display', 'none');
      scriptRow.css('display', 'none');
    }

    if (domType.value == 'module') {
      domTreeLocation.css('display', 'block');
      domAddProperty.css('display', 'none');
    } else {
      domTreeLocation.css('display', 'none');
      domAddProperty.css('display', 'block');
    }
  }

  $scope.addNode = function() {
    var domType = document.querySelector('#addnode-modal #type');
    var domName = document.querySelector('#addnode-modal #name');
    var domTitle = document.querySelector('#addnode-modal #title');

    var domProperties;
    if (domType.value == "module")
      domProperties = document.querySelectorAll('#addnode-properties #addnode-properties-table-readonly-view b3-property');
    else
      domProperties = document.querySelectorAll('#addnode-properties #addnode-properties-table b3-property');

    var originDirectory;

    // If no project is loaded or the selected mode is "none"...
    if (!$scope.projectLoaded || $scope.selectedDirMode == "none") {
      originDirectory = '';
    }
    // Otherwise, if the selected mode is "new"...
    else if ($scope.selectedDirMode == "new") {
      var domSaveLocation = document.querySelector('#addnode-modal #save-location-new #b3-file-input-value');
      
      originDirectory = domSaveLocation.value;
    }
    // Otherwise, as the selected mode is "existing"...
    else {
      var domSaveLocation = document.querySelector('#addnode-modal #save-location-preexisting');
      originDirectory = domSaveLocation.value;
    }

    var newNode = {
      type: domType.value,
      name: domName.value,
      title: domTitle.value,
      properties: {}
    }

    if (newNode.type == 'action') {
      var domOutputs = document.querySelectorAll("#addnode-output b3-property");
      var domCategory = document.querySelector('#addnode-modal #category');
      var domScript = document.querySelector('#addnode-modal #script');

      newNode.script = domScript.value;
      newNode.category = domCategory.value;
      newNode.output = {};

      // For each output in the DOM...
      for (var i = 0; i < domOutputs.length; i++) {
        // Get the data of the output through the b3Property's controller.
        var outputData = angular.element(domOutputs[i]).controller("b3Property").getContents();

        // If the property does not have a non-empty string as a name...
        if (!outputData.name) {
          // Send an error and abort.
          $window.app.editor.notifyError("Output at index {0} does not have a name.", i);
          return;
        }

        // Add to new node.
        newNode.output[outputData.name] = {
          type: outputData.type,
          key: outputData.key || null,
          value: outputData.value
        };
      }
    } else if (newNode.type == 'module') {
      newNode.pathToTree = $scope.pathToTree;
    }

    // If the name is empty or undefined...
    if (!newNode.name) {
      // Send an error and abort.
      $window.app.editor.notifyError("Please enter a name for your node.");
      return;
    }

    // For each property in the DOM...
    for (var i = 0; i < domProperties.length; i++) {
      // Get the data of the property through the b3Property's controller.
      var propertyData = angular.element(domProperties[i]).controller("b3Property").getContents();

      // If the property does not have a non-empty string as a name...
      if (!propertyData.name) {
        // Send an error and abort.
        $window.app.editor.notifyError("Property at index {0} does not have a name", i);
        return;
      }

      // Add to new node.
      newNode.properties[propertyData.name] = {
        type: propertyData.type,
        key: propertyData.key,
        value: propertyData.value
      };
    }

    // Make and add the new node.
    var nodeClass = $window.app.editor.makeAndAddNode(newNode, originDirectory);

    // If a node class was returned (i.e., the operation succeeded)...
    if (nodeClass)
      $scope.close("Yes");
  }
  
  /**
   * If a `path` is given, attempts to link the tree at that location to the current node definition. Otherwise,
   * attempts to search for the tree with the name provided on the DOM. If the file cannot be read or parsed when a 
   * `path` is given, an error message is displayed, and nothing else happens. The same thing happen when a path is not
   * given, minus the error message. Has no effect if the type is not "module".
   * 
   * @param {string?} path (optional) the path to the tree to link
   */
  $scope.linkTree = function(path) {
    var domType = document.querySelector('#addnode-modal #type');
    var domName = document.querySelector('#addnode-modal #name');

    // Do nothing if the type is not "module".
    if (domType.value != "module")
      return;
    
    // If a path is given...
    if (path) {
      // Try to get the tree.
      var parsed = this_.readTree(path, domName.value);

      // If no value was returned...
      if (!parsed)
        return;

      // Triggering a digest cycle is necessary here.
      $scope.$apply(function() {
        $scope.pathToTree = path;
        $scope.properties = this_.treeModuleParameters(parsed.parameters);
      });
    }  // Otherwise, if a non-empty name is given...
    else if (domName.value) {
      // Try to find the tree again.
      var moduleData = $window.app.editor.findModule(domName.value);

      // If the tree is not found...
      if (!moduleData) {
        var domPath = document.querySelector("#addnode-modal #tree-location #b3-file-input-value");

        // If a path is provided...
        if (domPath.value) {
          // Try to read the tree again. It might pass the checks this time.
          var contents = this_.readTree(domPath.value, domName.value);

          // If the tree passed the checks...
          if (contents)
            // Set moduleData according to the new results.
            moduleData = {contents: this_.readTree(domPath.value, domName.value), path: domPath.value};
        }
      }

      // If a tree link was successful...
      if (moduleData) {
        $scope.$apply(function() {
          $scope.pathToTree = moduleData.path;
          $scope.properties = this_.treeModuleParameters(moduleData.contents.parameters);
        })
      } else {
        // Unlink the tree.
        $scope.$apply(function() {
          $scope.pathToTree = undefined;
          $scope.properties = {};
        });
      }
    } else {
      // Unlink the tree.
      $scope.$apply(function() {
        $scope.pathToTree = undefined;
        $scope.properties = {};
      });
    }
  }

  /**
   * Attempts to open the tree. If unsuccessful, an error is displayed in the editor and/or logged.
   */
  $scope.openTree = function() {
    // Try to open the file.
    try {
      $window.app.editor.openTreeFile($scope.pathToTree);
    } catch (err) {
      $window.app.editor.logger.error("Failed to open tree '" + $scope.pathToTree + "': " + err);
    }
  }

  $timeout(function() {
    $scope.$apply(function() {
      $scope.changeType();
    })
  }, 1, false);
})

//
// EDIT NODE MODAL CONTROLLER
//
.controller('EditNodeModalController', function($scope, $window, $compile, close, node) {
  $scope.close = function(result) { close(result); };

  $scope.projectLoaded = $window.app.editor.project != null;
  $scope.node = $window.app.editor.nodes[node];

  $scope.valueTypes = [
    {id: 'json', name: 'json'},
    {id: "entity", name: "entity"},
    {id: "position", name: "position"},
    {id: "vec2", name: "vec2"},
    {id: "number", name: "number"},
    {id: "bool", name: "bool"},
    {id: "list", name: "list"},
    {id: "table", name: "table"},
    {id: "string", name: "string"}
  ];
  // Note: this variable also defines the directory selection modes to display.
  $scope.dirModeDisplayText = {
    existing: "Use existing save location",
    new: "Use new save location",
    none: "Use no save location"
  };
  $scope.defaultDirMode = "existing";
  $scope.selectedDirMode = $scope.defaultDirMode;
  $scope.directories = $window.app.editor.getOriginDirectories();

  $scope.pathToTree = $scope.node.prototype.pathToTree;
  $scope.type = $scope.node.prototype.type;
  $scope.properties = $scope.node.prototype.properties;
  $scope.output = $scope.node.prototype.output;

  this.propertyTemplate = '\
    <tr>\
      <td><b3-property editable="true" is-output="{0}"><b3-property></td>\
      <td><a href="#" propertyremovable class="button alert right" title="Remove {1}">-</a></td>\
    </tr>\
  ';

  this.treeModuleParameters = function(treeParameters) {
    var params = {}
    for (var key in treeParameters) {
      params[key] = {
        type: 'json',
        value: treeParameters[key]
      }
    }
    return params
  }

  var this_ = this;

  $scope.addProperty = function() {
    var template = this_.propertyTemplate.format("", "Property");
    var propertiesTable = angular.element(
      document.querySelectorAll('#editnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.addOutput = function() {
    var template = this_.propertyTemplate.format("a", "Output");
    var outputTable = angular.element(
      document.querySelectorAll('#editnode-output-table>tbody')
    );
    outputTable.append($compile(template)($scope));
  }

  $scope.saveNode = function() {
    var domName = document.querySelector('#editnode-form #name');
    var domTitle = document.querySelector('#editnode-form #title');
    var domProperties = document.querySelectorAll('#editnode-properties b3-property');

    var originDirectory;

    // If no project is loaded or the selected mode is "none"...
    if (!$scope.projectLoaded || $scope.selectedDirMode == "none") {
      originDirectory = '';
    }
    // Otherwise, if the selected mode is "new"...
    else if ($scope.selectedDirMode == "new") {
      var domSaveLocation = document.querySelector('#editnode-modal #save-location-new #b3-file-input-value');
      
      // If the save location is not an empty string (and thus does not trigger using the current working directory in 
      // path.relative)...
      if (domSaveLocation.value != '')
        originDirectory = path.relative($window.app.editor.project.fileName, domSaveLocation.value);
      else
        originDirectory = domSaveLocation.value;  // Technically an empty string.
    }
    // Otherwise, as the selected mode is "existing"...
    else {
      var domSaveLocation = document.querySelector('#editnode-modal #save-location-preexisting');
      originDirectory = domSaveLocation.value;
    }

    var newNode = {
      name: domName.value,
      title: domTitle.value,
      properties: {}
    }

    if ($scope.node.prototype.type == 'action') {
      var domOutputs = document.querySelectorAll("#editnode-output b3-property");
      var domCategory = document.querySelector('#editnode-modal #category');
      var domScript = document.querySelector('#editnode-modal #script');

      newNode.script = domScript.value;
      newNode.category = domCategory.value;
      newNode.output = {};

      // For each output in the DOM...
      for (var i = 0; i < domOutputs.length; i++) {
        // Get the data of the output through the b3Property's controller.
        var outputData = angular.element(domOutputs[i]).controller("b3Property").getContents();

        // If the property does not have a non-empty string as a name...
        if (!outputData.name) {
          // Send an error and abort.
          $window.app.editor.notifyError("Output at index {0} does not have a name.", i);
          return;
        }

        // Add to new node.
        newNode.output[outputData.name] = {
          type: outputData.type,
          key: outputData.key || null,
          value: outputData.value
        };
      }
    } else if ($scope.node.prototype.type == "module") {
      // $scope.pathToTree may be changed through $scope.linkTree().
      newNode.pathToTree = $scope.pathToTree;
    }

    // If the name is empty or undefined...
    if (!newNode.name) {
      // Send an error and abort.
      $window.app.editor.notifyError("Please enter a name for your node.");
      return;
    }

    // For each property in the DOM...
    for (var i = 0; i < domProperties.length; i++) {
      // Get the data of the property through the b3Property's controller.
      var propertyData = angular.element(domProperties[i]).controller("b3Property").getContents();

      // If the property does not have a non-empty string as a name...
      if (!propertyData.name) {
        // Send an error and abort.
        $window.app.editor.notifyError("Property at index {0} does not have a name", i);
        return;
      }

      // Add to new node.
      newNode.properties[propertyData.name] = {
        type: propertyData.type,
        key: propertyData.key,
        value: propertyData.value
      };
    }

    $window.app.editor.editNode(node, newNode, originDirectory, true);
    $scope.close("Yes");
  }

  $scope.removeNode = function() {
    var editor = $window.app.editor;
    var nodeProto = editor.nodes[node].prototype;
    var affectedGroups = [{
      originDirectory: nodeProto.originDirectory,
      category: nodeProto.category,
      type: nodeProto.type
    }];

    editor.pushCommandNode(affectedGroups, 'RemoveNode', {node});
  }

  /**
   * Attempts to open the tree. If unsuccessful, an error is displayed in the editor.
   */
  $scope.openTree = function() {
    $window.app.editor.openTreeFile($scope.pathToTree);
  }

  /**
   * Attempts to link the tree with path `path` to the current node definition. If the file cannot be read or parsed, an
   * error message is displayed, and nothing else happens.
   * 
   * @param {string} path the path to the tree to link
   */
  $scope.linkTree = function(path) {
    // Try to read the tree.
    try {
      var contents = fs.readFileSync(path);
    } catch (err) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Cannot read file: " + err;
      });

      return;
    }

    // Try to parse the contents.
    try {
      var parsed = JSON.parse(contents);
    } catch (err) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Cannot parse file: " + err;
      });

      return;
    }

    // If the name of the tree does not match the current name...
    if (parsed.name != $scope.node.prototype.name) {
      // Triggering a digest cycle is necessary here
      $scope.$apply(function() {
        $scope.errorMessage = "Invalid tree: Tree name is '" + parsed.name + "' when it should be '" + $scope.node.prototype.name + "'.";
      });

      return;
    }

    // Triggering a digest cycle is necessary here.
    $scope.$apply(function() {
      $scope.pathToTree = path;
      $scope.properties = this_.treeModuleParameters(parsed.parameters);
    });
  }
})

//
// EXPORT NODES MODAL CONTROLLER
//
.controller('ExportNodesModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };

  $scope.exportHierarchy = $window.app.editor.getNodeExportHierarchy();

  // Enum for state of origin directory exporting option.
  const ALL_SELECTED = 0;
  const SOME_SELECTED = 1;
  const NONE_SELECTED = 2;

  // HELPER FUNCTIONS---------------------------------
  // Returns ALL_SELECTED if all categories within a directory "dir" are selected, SOME_SELECTED if at least one is
  // selected, and NONE_SELECTED if no categories are selected.
  var getSelectionStatus = function(dir) {
    var exportDir = $scope.exportHierarchy[dir];

    // Check if at least one category is selected for export.
    var atLeastOneEnabled = false;
    var allEnabled = true;
    for (var category in exportDir) {
      // If a category is selected for export...
      if (exportDir[category]) {
        // Say that at least one is enabled.
        atLeastOneEnabled = true;
      }

      // If a category is not selected for export...
      if (!exportDir[category]) {
        // Say that not all are enabled.
        allEnabled = false;
      }
    }

    // If all are enabled...
    if (allEnabled) {
      return ALL_SELECTED;
    } else if (atLeastOneEnabled) {  // If only some are enabled...
      return SOME_SELECTED;
    } else {
      return NONE_SELECTED;
    }
  }
  // FUNCTIONS----------------------------------------
  // Toggles whether or not to export for a specific origin directory "dir" and a node category "category".
  $scope.toggleExport = function(dir, category) {
    $scope.exportHierarchy[dir][category] = !$scope.exportHierarchy[dir][category];
  }

  // Toggles whether or not to export nodes for a specific origin directory "dir". Disables all categories from being 
  // exported if at least one of them is enabled. Otherwise, enables all of them.
  $scope.toggleExportDir = function(dir) {
    var selectionStatus = getSelectionStatus(dir);

    var exportDir = $scope.exportHierarchy[dir];

    // If at least one is enabled...
    if (selectionStatus == ALL_SELECTED || selectionStatus == SOME_SELECTED) {
      // Disable all categories from being exported.
      for (var category in exportDir) {
        exportDir[category] = false;
      }
    } else {  // Otherwise...
      // Select all categories for export.
      for (var category in exportDir) {
        exportDir[category] = true;
      }
    }
  }

  // Returns the display style class to use for a category-level selector button.
  $scope.getDisplayStyle = function(dir, category) {
    if ($scope.exportHierarchy[dir][category]) {
      return "button export-selector all";
    } else {
      return "button export-selector none";
    }
  }
  // Returns the display style class to use for an origin directory-level selector button.
  $scope.getDisplayStyleDir = function(dir) {
    // Picks the style class to return based on the selection status.
    switch (getSelectionStatus(dir)) {
      case ALL_SELECTED:
        return 'button export-selector all';
      case SOME_SELECTED:
        return 'button export-selector some';
      case NONE_SELECTED:
        return 'button export-selector none';
    }    
  }

  // Returns the symbol to use for a category-level selector button.
  $scope.getDisplaySymbol = function(dir, category) {
    if ($scope.exportHierarchy[dir][category]) {
      return "✔";
    } else {
      return "_";
    }
  }
  // Returns the symbol to use for an origin directory-level selector button.
  $scope.getDisplaySymbolDir = function(dir) {
    // Picks the style class to return based on the selection status.
    switch (getSelectionStatus(dir)) {
      case ALL_SELECTED:
        return "✔";
      case SOME_SELECTED:
        return "-";
      case NONE_SELECTED:
        return "_";
    }    
  }

  // Export the nodes
  $scope.exportNodes = function() {
    $window.app.editor.exportNodes($scope.exportHierarchy);
  }

  /**
   * Returns whether or not all nodes in directory `dirName` are saved.
   * 
   * @param {string} dirName the save location to check
   * @returns true if all nodes in directory `dirName` are saved, false otherwise
   */
  $scope.dirIsSaved = function(dirName) {
    return $window.app.editor.globalNodeUndoHistory.dirIsSaved(dirName);
  }

  /**
   * Returns whether or not all nodes in group `groupName` in save location `dirName` are saved.
   * 
   * @param {string} dirName the save location in which to check
   * @param {string} groupName the category to check
   * @returns true if all nodes in group `groupName` in save location `dirName` are saved, false otherwise
   */
  $scope.groupIsSaved = function(dirName, groupName) {
    return $window.app.editor.globalNodeUndoHistory.categoryIsSaved(dirName, groupName);
  }

  /**
   * Returns whether or not the node group corresponding to `dirName` and `category` is to be exported as a patch file.
   * 
   * @param {string} dirName the name of the target save location
   * @param {string} category the name of the target category
   */
  $scope.getPatchMode = function(dirName, category) {
    return $window.app.editor.getNodesPatchMode(dirName, category);
  }
})

.directive('propertyremovable', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      element.bind('click', function() {
        element.parent().parent().remove();
        if (scope.updateProperties) {
          scope.updateProperties();
        }
      });
    }
  };
});