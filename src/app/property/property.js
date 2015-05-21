angular.module('app.property', [])

.controller('PropertyController', function($scope, $timeout, $compile, $window) {
  // DYNAMIC ROW
  this.panel = angular.element(
    document.querySelector('#property-panel')
  );
  this.table = angular.element(
    document.querySelector('#property-properties-table>tbody')
  );
  this.outputs = angular.element(
    document.querySelector('#property-output-table>tbody')
  );
  this.template = '\
    <tr>\
      <td><input id="key" type="text" value="{0}" onkeyup="element(this).updateProperties(this);" placeholder="key" readonly/></td>\
      <td><input id="value" type="text" value="{1}" onkeyup="element(this).updateProperties(this);" placeholder="value" /></td>\
    </tr>\
  ';
  
  var this_ = this;
  $scope.addRow = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");
    var template = this_.template.format(key, value);
    this_.table.append($compile(template)($scope));
  }

  $scope.addOutput = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';;
    var template = this_.template.format(key, value);
    this_.outputs.append($compile(template)($scope));
  }

  // SELECTION/DESELECTION
  $scope.block = null;
  this.updateProperties = function() {
    if ($window.app.editor.selectedBlocks.length === 1) {
      var block = $window.app.editor.selectedBlocks[0];

      this_.table.html('');
      this_.outputs.html('');
      var domName = document.querySelector('#property-panel #name');
      var domTitle = document.querySelector('#property-panel #title');

      domName.value = block.name;
      domTitle.value = block.title || '';

      for (key in block.node.prototype.properties) {
        var value = block.properties[key] !== '' ? block.properties[key] : '';
        $scope.addRow(key, value);
      }

      if (block.type == 'action') {
        for (key in block.node.prototype.output) {
          var value = block.output[key] !== '' ? block.output[key] : '';
          $scope.addOutput(key, value);
        }
      }
    } else {
      var block = null;
    }


    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.block = block;
      });
    }, 0, false);
  }
  $window.app.editor.on('blockselected', this.updateProperties, this);
  $window.app.editor.on('blockdeselected', this.updateProperties, this);
  $window.app.editor.on('treeselected', this.updateProperties, this);
  this.updateProperties();

  // UPDATE PROPERTIES ON NODE
  $scope.updateProperties = function() {
    var domTitle = document.querySelector('#property-panel #title');
    var domKeys = document.querySelectorAll('#property-properties-table #key');
    var domValues = document.querySelectorAll('#property-properties-table #value');

    var newNode = {
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

      if (key && value != '') {
        newNode.properties[key] = value;
      }
    }
    
    if ($scope.block.type == 'action') {
      var domKeys = document.querySelectorAll('#property-output-table #key');
      var domValues = document.querySelectorAll('#property-output-table #value');

      newNode.output = {};

      for (var i=0; i<domKeys.length; i++) {
        var key = domKeys[i].value;
        var value = domValues[i].value;

        if (key && value != '') {
          newNode.output[key] = value;
        }
      }
    }
    
    $window.app.editor.editBlock($scope.block, newNode)
  }
})

.directive('propertypanel', function() {
  return {
    restrict: 'E',
    transclude: true,
    controller: 'PropertyController',
    templateUrl: 'app/property/property.html'
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
});