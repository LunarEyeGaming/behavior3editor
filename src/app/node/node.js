angular.module('app.node', ['app.modal'])

//
// NODE CONTROLLER
//
.controller('NodeController', function($scope, $rootScope, $window, $timeout, ModalService) {
  var this_ = this;

  // SCOPE --------------------------------------------------------------------
  $scope.types = ['composite', 'decorator', 'action', 'module'];
  $scope.nodes = {};
  
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

    for (key in guiNodes) {
      for (nodeName in editorNodes) {
        var node = editorNodes[nodeName];
        if (node.prototype.type === key) {
          guiNodes[key].push(node);
        }
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
  
  this.propertyTemplate = '\
    <tr>\
      <td><input id="key" type="text" value="{0}" placeholder="key" /></td>\
      <td><input id="value" type="text" value="{1}" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  $scope.types = ['composite', 'decorator', 'action', 'module'];

  var this_ = this;

  $scope.addProperty = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");
    var template = this_.propertyTemplate.format(key, value);
    var propertiesTable = angular.element(
      document.querySelectorAll('#addnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.addNode = function() {
    var domType = document.querySelector('#addnode-modal #type');
    var domName = document.querySelector('#addnode-modal #name');
    var domTitle = document.querySelector('#addnode-modal #title');
    var domKeys = document.querySelectorAll('#addnode-properties #key');
    var domValues = document.querySelectorAll('#addnode-properties #value');

    var newNode = {
      type: domType.value,
      name: domName.value,
      title: domTitle.value,
      properties: {}
    }

    for (var i=0; i<domKeys.length; i++) {
      var key = domKeys[i].value;
      var value = domValues[i].value;

      try {
        value = JSON.parse(value);
      } catch (e){
        $window.app.editor.trigger('notification', name, {
          level: 'error',
          message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
        });
      }

      if (key) {
        newNode.properties[key] = value;
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

  this.jsonProperties = function(properties){
    var props = {}
    for (key in properties) {
      props[key] = JSON.stringify(properties[key]);
    }
    return props;
  }

  $scope.properties = this.jsonProperties($scope.node.prototype.properties);
  
  this.propertyTemplate = '\
    <tr>\
      <td><input id="key" type="text" value="{0}" placeholder="key" /></td>\
      <td><input id="value" type="text" value="{1}" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;

  $scope.addProperty = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");
    var template = this_.propertyTemplate.format(key, value);
    var propertiesTable = angular.element(
      document.querySelectorAll('#editnode-properties-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  $scope.saveNode = function() {
    var domName = document.querySelector('#editnode-form #name');
    var domTitle = document.querySelector('#editnode-form #title');
    var domKeys = document.querySelectorAll('#editnode-properties #key');
    var domValues = document.querySelectorAll('#editnode-properties #value');
    
    var newNode = {
      name: domName.value,
      title: domTitle.value,
      properties: {}
    }

    for (var i=0; i<domKeys.length; i++) {
      var key = domKeys[i].value;
      var value = domValues[i].value;

      try {
        value = JSON.parse(value);
      } catch (e){
        $window.app.editor.trigger('notification', name, {
          level: 'error',
          message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
        });
      }

      if (key) {
        newNode.properties[key] = value;
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