angular.module('app.property', [])

.controller('PropertyController', function($scope, $timeout, $compile, $window) {
  // CONSTANTS (represent an enum for the type of screen to display).
  $scope.SCRN_UNSELECTED = 0
  $scope.SCRN_SELECTED = 1
  $scope.SCRN_UNREGISTERED = 2

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
      <td><input id="is_key" type="checkbox" onchange="element(this).updateProperties(this);" {0} readonly/>key</td>\
      <td><label id="key" for="{2}">{1}</label><input id="value" type="text" value="{2}" onkeyup="element(this).updateProperties(this);" placeholder="value" /></td>\
    </tr>\
  ';
  this.outputTemplate = '\
    <tr>\
      <td><label id="key" for="{1}">{0}</label><input id="value" type="text" value="{1}" onkeyup="element(this).updateProperties(this);" placeholder="value" /></td>\
    </tr>\
  ';
  this.rootTemplate ='\
    <tr>\
      <td><input id="key" type="text" value="{0}" onkeyup="element(this).updateProperties(this);" placeholder="key" /></td>\
      <td><input id="value" type="text" value="{1}" onkeyup="element(this).updateProperties(this);" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;
  $scope.addRow = function(key, value) {
    if (value == undefined) value = {type: 'json', value: null};
    var isKey = value.key === undefined ? false : true;

    var valString = value.value
    if (valString === undefined) {
      valString = value.key;
    }
    if (valString == null) valString = '';
    if (valString !== '' && !isKey && value.type != 'string') {
      valString = JSON.stringify(valString);
    }
    valString = valString.replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");

    if (isKey) {
      isKey = "checked";
    } else {
      isKey = "";
    }
    var template = this_.template.format(isKey, key, valString);
    this_.table.append($compile(template)($scope));
  }
  $scope.addRootProperty = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");
    var template = this_.rootTemplate.format(key, value);
    this_.table.append($compile(template)($scope));
  }

  $scope.addOutput = function(key, value) {
    if (key == undefined) key = '';
    if (value == undefined) value = '';
    var template = this_.outputTemplate.format(key, value);
    this_.outputs.append($compile(template)($scope));
  }

  // SELECTION/DESELECTION
  $scope.block = null;
  this.updateProperties = function() {
    var selectedBlocks = $window.app.editor.selectedBlocks;
    // If exactly one block has been selected...
    if (selectedBlocks.length === 1) {
      // If the block is registered...
      if (selectedBlocks[0].isRegistered) {
        var block = selectedBlocks[0];
        var screen = $scope.SCRN_SELECTED;

        this_.table.html('');
        this_.outputs.html('');
        var domName = document.querySelector('#property-panel #name');
        var domTitle = document.querySelector('#property-panel #title');

        domName.value = block.name;
        domTitle.value = block.title || '';

        for (key in block.node.prototype.properties) {
          $scope.addRow(key, block.properties[key]);
        }

        if (block.type == 'root') {
          for (key in block.properties) {
            $scope.addRootProperty(key, block.properties[key]);
          }
        }

        if (block.type == 'action') {
          for (key in block.node.prototype.output) {
            // The tertiary statement is necessary because block.output[key] can be undefined.
            $scope.addOutput(key, block.output[key] ? block.output[key].key : undefined);
          }
        }
      } else {  // Otherwise...
        var block = null;
        var screen = $scope.SCRN_UNREGISTERED;
      }
    } else {  // Otherwise...
      var block = null;
      var screen = $scope.SCRN_UNSELECTED;
    }

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.block = block;
        $scope.screen = screen;
      });
    }, 0, false);
  }
  $window.app.editor.on('blockselected', this.updateProperties, this);
  $window.app.editor.on('blockdeselected', this.updateProperties, this);
  $window.app.editor.on('treeselected', this.updateProperties, this);
  this.updateProperties();

  // UPDATE PROPERTIES ON NODE
  $scope.updateProperties = function() {
    var node = $scope.block.node;

    var domTitle = document.querySelector('#property-panel #title');
    var domKeys = document.querySelectorAll('#property-properties-table #key');
    var domValues = document.querySelectorAll('#property-properties-table #value');
    var domIsKeys = []
    if (node.prototype.type != 'root') {
      domIsKeys = document.querySelectorAll('#property-properties-table #is_key');
    }

    var newNode = {
      title: domTitle.value,
      properties: {}
    }

    var isRoot = node.prototype.type == 'root';
    for (var i=0; i<domKeys.length; i++) {
      var isKey = isRoot ? false : domIsKeys[i].checked;
      var key = isRoot ? domKeys[i].value : domKeys[i].innerText;
      var value = domValues[i].value;
      if (value == '') value = null;

      var valueType = isRoot ? 'json' : node.prototype.properties[key].type;
      if (!isKey && valueType != 'string') {
        try {
          value = JSON.parse(value);
        } catch (e){
          $window.app.editor.trigger('notification', name, {
            level: 'error',
            message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
          });
        }
      }

      if (key) {
        newNode.properties[key] = {
          type: valueType
        }
        if (isRoot) {
          newNode.properties[key] = value
        } else {
          if (isKey) {
            newNode.properties[key].key = value
          } else {
            newNode.properties[key].value = value
          }
        }
      }
    }

    if ($scope.block.type == 'action') {
      var domKeys = document.querySelectorAll('#property-output-table #key');
      var domValues = document.querySelectorAll('#property-output-table #value');

      newNode.output = {};

      for (var i=0; i<domKeys.length; i++) {
        var key = domKeys[i].innerText;
        var value = domValues[i].value;
        if (value == '') value = null;

        // if (valueType != 'string') {
        //   try {
        //     value = JSON.parse(value);
        //   } catch (e){
        //     $window.app.editor.trigger('notification', name, {
        //       level: 'error',
        //       message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
        //     });
        //   }
        // }

        newNode.output[key] = {
          type: node.prototype.output[key].type,
          key: value || null
        }
      }
    }

    $window.app.editor.pushCommandTree('EditBlock', {
      block: $scope.block, 
      changes: newNode
    });
  }
})

.directive('propertyremovable', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      element.bind('click', function() {
        element.parent().parent().remove();
      });
    }
  };
})

.directive('propertypanel', function() {
  return {
    restrict: 'E',
    transclude: true,
    controller: 'PropertyController',
    templateUrl: 'app/property/property.html'
  }
});
