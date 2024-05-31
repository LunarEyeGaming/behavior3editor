angular.module('app.node', ['app.modal'])

//
// NODE CONTROLLER
//
.controller('NodeController', function($scope, $rootScope, $window, $timeout, ModalService) {
  var this_ = this;

  // SCOPE --------------------------------------------------------------------
  $scope.types = ['composite', 'decorator', 'action', 'module'];
  $scope.nodes = {};
  $scope.categories = {};

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
   * @returns truthy if the directory is not undefined and is in the project (when the project is defined), falsy
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
   * Returns a truthy or falsy value depending on whether or not a project is loaded, the directory `dirName` is not
   * `"undefined"`, and the project allows a directory to be removed (if `isRemoveButton` is true). This function 
   * represents whether or not a corresponding button should be displayed for the directory.
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
   * Returns whether or not all nodes in directory `dirName` are saved.
   * 
   * @param {string} dirName the save location to check
   * @returns true if all nodes in directory `dirName` are saved, false otherwise
   */
  $scope.dirIsSaved = function(dirName) {
    return $window.app.editor.globalNodeUndoHistory.dirIsSaved(dirName);
  }

  /**
   * Returns whether or not the nodes of type `typeName` in save location `dirName` are saved.
   * 
   * @param {string} dirName the save location in which to check
   * @param {string} typeName the name of the type to check
   * @returns true if the nodes of type `typeName` in save location `dirName` are saved, false otherwise
   */
  $scope.typeIsSaved = function(dirName, typeName) {
    return $window.app.editor.globalNodeUndoHistory.typeIsSaved(dirName, typeName);
  }

  /**
   * Returns whether or not all nodes of category `category` in save location `dirName` are saved.
   * 
   * @param {string} dirName the save location in which to check
   * @param {string} category the category to check
   * @returns true if all nodes of category `category` in save location `dirName` are saved, false otherwise
   */
  $scope.categoryIsSaved = function(dirName, category) {
    return $window.app.editor.globalNodeUndoHistory.categoryIsSaved(dirName, category);
  }
  // --------------------------------------------------------------------------

  // UPDATE NODES--------------------------------------------------------------
  this.updateNodes = function() {
    var guiNodes = {};
    var editorNodes = $window.app.editor.nodes;

    // For each node in the editor's nodes...
    for (nodeName in editorNodes) {
      // If the node's name is "Root"...
      if (nodeName == "Root")
        continue;

      var node = editorNodes[nodeName];

      // If the origin directory has no corresponding entry, create it. Otherwise, do nothing.
      if (guiNodes[node.prototype.originDirectory] === undefined) {
        guiNodes[node.prototype.originDirectory] = {
          'composite'        : [],
          'decorator'        : [],
          'action'           : [],
          'module'           : [],
          'actionCategories' : {}  // Used to display nodes by category
        };
      }

      var guiNodesInDir = guiNodes[node.prototype.originDirectory];

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

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = guiNodes;
      });
    }, 0, false);
  }
  // --------------------------------------------------------------------------

  // ADD NODE -----------------------------------------------------------------
  /**
   * Adds a node `node` to the node display list.
   * 
   * @param {b3editor.Action | b3editor.Composite | b3editor.Decorator | b3editor.Module} node the node to add
   */
  this.addNode = function(node) {
    var guiNodes = $scope.nodes;

    // If the origin directory has no corresponding entry, create it. Otherwise, do nothing.
    if (guiNodes[node.prototype.originDirectory] === undefined) {
      guiNodes[node.prototype.originDirectory] = {
        'composite'        : [],
        'decorator'        : [],
        'action'           : [],
        'module'           : [],
        'actionCategories' : {}  // Used to display nodes by category
      };
    }

    var guiNodesInDir = guiNodes[node.prototype.originDirectory];

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

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = guiNodes;
      });
    }, 0, false);
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

    var guiNodes = $scope.nodes;
    var guiNodesInDir = guiNodes[originDirectory];

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

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = guiNodes;
      });
    }, 0, false);
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
      $window.app.editor.trigger('notification', name, {
        level: 'error',
        message: 'Cannot export nodes. No project loaded.'
      });
    } else {
      $scope.showExportNodesModal();
    }
  }
  // --------------------------------------------------------------------------

  // REGISTER EVENTS ----------------------------------------------------------
  $window.app.editor.on('nodeadded', function(e) {this.addNode(e._target)}, this);
  $window.app.editor.on('noderemoved', function(e) {this.removeNode(e._target)}, this);
  $window.app.editor.on('nodechanged', function(e) {
    this.editNode(e._target, e.oldOriginDirectory, e.oldCategory)
  }, this);
  $rootScope.$on('onButtonNewNode', function() {$scope.showAddNodeModal()});
  $rootScope.$on('onButtonExportNodes', this.onButtonExportNodes);
  // --------------------------------------------------------------------------

  // INITIALIZE ELEMENTS ------------------------------------------------------
  this.updateNodes();
  // --------------------------------------------------------------------------
})


//
// ADD NODE MODAL CONTROLLER
//
.controller('AddNodeModalController', function($scope, $window, $compile, $timeout, close, originDirectory, type, category) {
  $scope.close = function(result) { close(result); };

  $scope.originDirectory = originDirectory;
  $scope.inputNodeType = type;
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
      <td>\
        <select id="type">\
          <option ng-repeat="valueType in valueTypes" value="{{valueType.id}}">{{valueType.name}}</option>\
        </select>\
      </td>\
      <td><input id="key" type="text" value="" placeholder="key" /></td>\
      <td><input id="value" type="text" value="" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;

  $scope.addProperty = function() {
    var template = this_.propertyTemplate.format();
    var propertiesTable = angular.element(
      document.querySelectorAll('#addnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.addOutput = function() {
    var template = this_.propertyTemplate.format();
    var outputTable = angular.element(
      document.querySelectorAll('#addnode-output-table>tbody')
    );
    outputTable.append($compile(template)($scope));
  }

  $scope.changeType = function() {
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
  }

  $scope.addNode = function() {
    var domType = document.querySelector('#addnode-modal #type');
    var domName = document.querySelector('#addnode-modal #name');
    var domTitle = document.querySelector('#addnode-modal #title');
    var domPropertyTypes = document.querySelectorAll('#addnode-properties #type');
    var domPropertyKeys = document.querySelectorAll('#addnode-properties #key');
    var domPropertyValues = document.querySelectorAll('#addnode-properties #value');

    var originDirectory;

    // If no project is loaded or the selected mode is "none"...
    if (!$scope.projectLoaded || $scope.selectedDirMode == "none") {
      originDirectory = '';
    }
    // Otherwise, if the selected mode is "new"...
    else if ($scope.selectedDirMode == "new") {
      var domSaveLocation = document.querySelector('#addnode-modal #save-location-new #b3-file-input-value');
      
      // If the save location is not an empty string (and thus does not trigger using the current working directory in 
      // path.relative)...
      if (domSaveLocation.value != '')
        originDirectory = path.relative($window.app.editor.project.fileName, domSaveLocation.value);
      else
        originDirectory = domSaveLocation.value;  // Technically an empty string.
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

    if (newNode.type == 'action'){
      var domOutputTypes = document.querySelectorAll('#addnode-output #type');
      var domOutputKeys = document.querySelectorAll('#addnode-output #key');
      var domOutputValues = document.querySelectorAll('#addnode-output #value');
      var domCategory = document.querySelector('#addnode-modal #category');
      var domScript = document.querySelector('#addnode-modal #script');

      newNode.script = domScript.value;
      newNode.category = domCategory.value;
      newNode.output = {};

      for (var i=0; i<domOutputKeys.length; i++) {
        var type = domOutputTypes[i].value;
        var key = domOutputKeys[i].value;
        var value = domOutputValues[i].value;
        if (value === '') value = null;
        if (key)
          newNode.output[key] = value;
      }
    }

    for (var i=0; i<domPropertyKeys.length; i++) {
      var type = domPropertyTypes[i].value;
      var key = domPropertyKeys[i].value;
      var value = domPropertyValues[i].value;

      if (type != 'string' && value != '') {
        try {
          value = JSON.parse(value);
        } catch (e){
          $window.app.editor.trigger('notification', name, {
            level: 'error',
            message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
          });
        }
      }

      if (value === '') value = null;
      if (key) {
        newNode.properties[key] = {
          type: type,
          value: value
        };
      }
    }

    // If the name is not empty or otherwise undefined...
    if (newNode.name) {
      // Attempt to make the node class.
      var nodeClass = $window.app.editor.makeNode(newNode, originDirectory);

      // If a node class was returned (i.e., the operation succeeded)...
      if (nodeClass) {
        var affectedGroups = [{originDirectory, category: newNode.category, type: newNode.type}];
        // Push the command to the editor.
        $window.app.editor.pushCommandNode(affectedGroups, 'AddNode', {node: nodeClass});
        $scope.close("Yes");
      }
    } else {
      $window.app.editor.trigger('notification', name, {
        level: 'error',
        message: "Please enter a name for your node."
      });
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

  this.jsonProperties = function(properties){
    var props = {}
    for (key in properties) {
      props[key] = {
        type: properties[key].type
      }
      if (properties[key].type != 'string') {
        if (properties[key].value === null)
          props[key].value = '';
        else
          props[key].value = JSON.stringify(properties[key].value);
      } else {
        props[key].value = properties[key].value;
      }
    }
    return props;
  }

  $scope.properties = this.jsonProperties($scope.node.prototype.properties);
  $scope.output = $scope.node.prototype.output;

  this.propertyTemplate = '\
    <tr>\
      <td>\
        <select id="type">\
          <option ng-repeat="valueType in valueTypes" value="{{valueType.id}}">{{valueType.name}}</option>\
        </select>\
      </td>\
      <td><input id="key" type="text" value="" placeholder="key" /></td>\
      <td><input id="value" type="text" value="" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;

  $scope.addProperty = function() {
    var template = this_.propertyTemplate.format();
    var propertiesTable = angular.element(
      document.querySelectorAll('#editnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.addOutput = function() {
    var template = this_.propertyTemplate.format();
    var outputTable = angular.element(
      document.querySelectorAll('#editnode-output-table>tbody')
    );
    outputTable.append($compile(template)($scope));
  }

  $scope.saveNode = function() {
    var domName = document.querySelector('#editnode-form #name');
    var domTitle = document.querySelector('#editnode-form #title');
    var domTypes = document.querySelectorAll('#editnode-properties #type');
    var domKeys = document.querySelectorAll('#editnode-properties #key');
    var domValues = document.querySelectorAll('#editnode-properties #value');

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

    if ($scope.node.prototype.type == 'action'){
      var domOutputTypes = document.querySelectorAll('#editnode-output #type');
      var domOutputKeys = document.querySelectorAll('#editnode-output #key');
      var domOutputValues = document.querySelectorAll('#editnode-output #value');
      var domCategory = document.querySelector('#editnode-modal #category');
      var domScript = document.querySelector('#editnode-modal #script');

      newNode.script = domScript.value;
      newNode.category = domCategory.value;
      newNode.output = {};

      for (var i=0; i<domOutputKeys.length; i++) {
        var type = domOutputTypes[i].value;
        var key = domOutputKeys[i].value;
        var value = domOutputValues[i].value;
        if (value === '') value = null;
        if (key)
          newNode.output[key] = {
            type: type,
            key: value
          };
      }
    }

    for (var i=0; i<domKeys.length; i++) {
      var type = domTypes[i].value
      var key = domKeys[i].value;
      var value = domValues[i].value;

      if (type != 'string' && value != '') {
        try {
          value = JSON.parse(value);
        } catch (e){
          $window.app.editor.trigger('notification', name, {
            level: 'error',
            message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
          });
        }
      }

      if (value === '') value = null;
      if (key) {
        newNode.properties[key] = {
          type: type,
          value: value
        };
      }
    }

    if (newNode.name) {
      $window.app.editor.editNode(node, newNode, originDirectory, true);
    }
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