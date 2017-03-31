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

  $scope.showAddNodeModal = function() {
    ModalService.showModal({
      templateUrl: "app/node/modal-addnode.html",
      controller: 'AddNodeModalController'
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
  // --------------------------------------------------------------------------

  // UPDATE NODES--------------------------------------------------------------
  this.updateNodes = function() {
    var guiNodes = {
      'composite' : [],
      'decorator' : [],
      'action'    : [],
      'module'    : []
    };
    var editorNodes = $window.app.editor.nodes;
    var categoryNodes = {};

    for (nodeName in editorNodes) {
      var node = editorNodes[nodeName];
      for (key in guiNodes) {
        if (node.prototype.type === key) {
          guiNodes[key].push(node);
        }
      }

      if (node.prototype.type == 'action'){
        if (!categoryNodes[node.prototype.category])
          categoryNodes[node.prototype.category] = [];

        categoryNodes[node.prototype.category].push(node);
      }
    }

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = guiNodes;
        $scope.categories = categoryNodes;
      });
    }, 0, false);
  }
  // --------------------------------------------------------------------------

  // REGISTER EVENTS ----------------------------------------------------------
  $window.app.editor.on('nodeadded', this.updateNodes, this);
  $window.app.editor.on('noderemoved', this.updateNodes, this);
  $window.app.editor.on('nodechanged', this.updateNodes, this);
  $rootScope.$on('onButtonNewNode', $scope.showAddNodeModal);
  // --------------------------------------------------------------------------

  // INITIALIZE ELEMENTS ------------------------------------------------------
  this.updateNodes();
  // --------------------------------------------------------------------------
})


//
// ADD NODE MODAL CONTROLLER
//
.controller('AddNodeModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };

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

    if (newNode.name) {
      $window.app.editor.addNode(newNode);
    }
  }
})

.directive('propertyremovable', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      element.bind('click', function() {
        element.parent().parent().remove();
        scope.updateProperties();
      });
    }
  };
})

//
// EDIT NODE MODAL CONTROLLER
//
.controller('EditNodeModalController', function($scope, $window, $compile, close, node) {
  $scope.close = function(result) { close(result); };

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
    var template = this_.propertyTemplate.format(type, key, value);
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

      if (domScript.value != '')
        newNode.script = domScript.value;
      if (domCategory.value != '')
        newNode.category = domCategory.value;
      if (domOutputKeys.length > 0)
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
      $window.app.editor.editNode(node, newNode);
    }
  }

  $scope.removeNode = function() {
    $window.app.editor.removeNode(node);
  }
});
