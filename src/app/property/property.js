angular.module('app.property', [])

.controller('PropertyPanelController', function($scope, $timeout, $compile, $window) {
  /*
  General comment:
  onchange is hooked up to trigger the $scope.editProperties() function, which causes changes in the block to be 
  registered. This works most of the time, except when the user goes to deselect the block or select a different one. 
  Because onchange fires after the selection change is handled, $scope.editProperties() will be run. The workaround to
  this is to have $scope.editProperties() be called when this.editProperties() is called, hook up onkeyup to set a
  flag indicating change ($scope.changesMade), and make $scope.editProperties() run its main body of code only when 
  $scope.changesMade is true and then unset $scope.changesMade at the end. This makes it so that $scope.editProperties()
  truly runs only when it needs to.
  This comment applies to the implementation of the b3PropertyChangeListener directive.
  */
  // CONSTANTS (represent an enum for the type of screen to display).
  $scope.SCRN_UNSELECTED = 0
  $scope.SCRN_SELECTED = 1
  $scope.SCRN_UNREGISTERED = 2
  $scope.SCRN_INVALID = 3

  // DYNAMIC ROW
  this.panel = angular.element(
    document.querySelector('#property-panel')
  );
  this.propertyTable = angular.element(
    document.querySelector('#property-properties-table>tbody')
  );
  this.outputTable = angular.element(
    document.querySelector('#property-output-table>tbody')
  );
  this.template = '\
    <tr>\
      <td>Key<input id="is_key" type="checkbox" onchange="element(this).editProperties(this);" {0} readonly/></td>\
      <td><label id="key" for="{2}">{1}</label><input id="value" type="text" value="{2}" onchange="element(this).editProperties(this);" onkeyup="element(this).markForChange(this);" placeholder="value" /></td>\
    </tr>\
  ';
  this.outputTemplate = '\
    <tr>\
      <td><label id="key" for="{1}">{0}</label><input id="value" type="text" value="{1}" onchange="element(this).editProperties(this);" onkeyup="element(this).markForChange(this);" placeholder="value" /></td>\
    </tr>\
  ';
  this.rootTemplate ='\
    <tr>\
      <td><input id="key" type="text" value="{0}" onchange="element(this).editProperties(this);" onkeyup="element(this).markForChange(this);" placeholder="key" /></td>\
      <td><input id="value" type="text" value="{1}" onchange="element(this).editProperties(this);" onkeyup="element(this).markForChange(this);" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;
  $scope.addRootProperty = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");
    var template = this_.rootTemplate.format(key, value);
    this_.propertyTable.append($compile(template)($scope));
  }

  $scope.addOutput = function(key, value) {
    if (key == undefined) key = '';
    if (value == undefined) value = '';
    var template = this_.outputTemplate.format(key, value);
    this_.outputTable.append($compile(template)($scope));
  }

  // SELECTION/DESELECTION
  $scope.block = null;
  this.updatePropertiesDisplay = function() {
    // Before switching, trigger $scope.editProperties() to update the node properties.
    $scope.editProperties();

    var selectedBlocks = $window.app.editor.selectedBlocks;
    var properties = undefined;
    var block = null;
    var screen;
    // If exactly one block has been selected...
    if (selectedBlocks.length === 1) {
      // If the block is invalid...
      if (selectedBlocks[0].isInvalid) {
        screen = $scope.SCRN_INVALID;
      // Otherwise, if the block is registered...
      } else if (selectedBlocks[0].isRegistered) {
        block = selectedBlocks[0];
        screen = $scope.SCRN_SELECTED;

        properties = [];

        this_.propertyTable.html('');
        this_.outputTable.html('');
        var domName = document.querySelector('#property-panel #name');
        var domTitle = document.querySelector('#property-panel #title');

        domName.value = block.name;
        domTitle.value = block.title || '';

        // Add properties from node prototype. This has no effect when the block is the root.
        for (key in block.node.prototype.properties) {
          var protoData = block.node.prototype.properties[key];

          properties.push(this.toB3PropertyData(key, block.properties[key], protoData));
        }

        // If the block is the root...
        if (block.type == 'root') {
          // Add root properties.
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
        screen = $scope.SCRN_UNREGISTERED;
      }
    } else {  // Otherwise...
      screen = $scope.SCRN_UNSELECTED;
    }

    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.block = block;
        $scope.properties = properties;
        $scope.screen = screen;
      });
    }, 0, false);
  }
  
  /**
   * Based on the provided property name `key`, the value of the property `value`, and the node definition data
   * corresponding to the property, generates and returns data to use when generating a `b3-property` element. Schema:
   * * `type: string` - The type of the property
   * * `value: any` - The value of the property
   * * `usesKey: boolean` - Whether or not the property uses a key as its value.
   * * `propName: string` - The name of the property to display
   * 
   * @param {string} key the name of the property
   * @param {*} value the value of the property that the block has.
   * @param {*} protoData node definition data corresponding to the property
   * @returns data to use when generating a `b3-property` element
   */
  this.toB3PropertyData = function(key, value, protoData) {
    var result = {};
    result.propName = key;
    result.type = protoData.type;

    // If a value is defined inside the block...
    if (value != undefined) {
      // If a key is defined...
      if (value.key) {
        result.usesKey = true;
        result.value = value.key;
      } else {
        result.usesKey = false;
        result.value = value.value;
      }
    }

    return result;
  }

  /**
   * Converts b3-property contents into the property format used by blocks and returns the result, or `undefined` if the
   * given data has no `value`
   * 
   * @param {object} data the contents of the b3-property directive to convert
   * @param {string} data.name the name of the property
   * @param {string} data.type the type of the property
   * @param {boolean} data.usesKey whether or not the value is a board variable reference
   * @param {*} data.value the value of the data
   * @returns an object containing the `name` (key) and `contents` (value) of the property, or `undefined` if the data's
   * `value` is `undefined`.
   */
  this.fromB3PropertyData = function(data) {
    var result;

    // If the data has a value...
    if (data.value) {
      // Convert the data.
      result = {};
      result.name = data.name;
      result.contents = {};
      result.contents.type = data.type;
      
      // If the data uses a key...
      if (data.usesKey) {
        result.contents.key = data.value;
      } else {
        result.contents.value = data.value;
      }
    } else {
      // Return undefined.
      result = undefined;
    }

    return result;
  }

  // UPDATE PROPERTIES ON NODE
  $scope.editProperties = function() {
    // If $scope.changesMade is false...
    if (!$scope.changesMade)
      // Abort.
      return;

    var node = $scope.block.node;

    var domTitle = document.querySelector('#property-panel #title');

    var newNode = {
      title: domTitle.value,
      properties: {}
    }

    var isRoot = node.prototype.type == 'root';

    // If the block is a root...
    if (isRoot) {
      // Extract the property data from the DOM.
      var domKeys = document.querySelectorAll('#property-properties-table #key');
      var domValues = document.querySelectorAll('#property-properties-table #value');

      for (var i=0; i<domKeys.length; i++) {
        var key = domKeys[i].value;  // Property name
        var value = domValues[i].value;  // Contained value
        if (value == '') value = null;

        try {
          value = JSON.parse(value);
        } catch (e){
          $window.app.editor.trigger('notification', name, {
            level: 'error',
            message: 'Invalid JSON value in property \'' + key + '\'. <br>' + e
          });
        }

        // If the property name is defined...
        if (key) {
          newNode.properties[key] = value
        }
      }
    } else {
      // Get the property data from the controllers corresponding to the properties.
      var domProperties = document.querySelectorAll("b3-property#property-panel-property");

      domProperties.forEach(property => {
        // Get controller.
        var propertyCtrl = angular.element(property).controller("b3Property");

        // Get property data.
        var propertyData = this_.fromB3PropertyData(propertyCtrl.getContents());

        // If the data is defined...
        if (propertyData)
          // Add to new node.
          newNode.properties[propertyData.name] = propertyData.contents;
      });
    }

    if ($scope.block.type == 'action') {
      var domKeys = document.querySelectorAll('#property-output-table #key');
      var domValues = document.querySelectorAll('#property-output-table #value');

      newNode.output = {};

      for (var i=0; i<domKeys.length; i++) {
        var key = domKeys[i].innerText;
        var value = domValues[i].value;
        if (value == '') value = null;

        newNode.output[key] = {
          type: node.prototype.output[key].type,
          key: value || null
        }
      }
    }

    $window.app.editor.pushCommandTree('EditBlock', {
      block: $scope.block, 
      changes: newNode
    }, true);
    
    // Reset changesMade variable. This keeps this function from activating inappropriately (such as when no actual 
    // changes are made or when onchange triggers this function a second time after the user changes blocks--the first
    // time being during the handling of the selection).
    $scope.changesMade = false;
  }

  $scope.markForChange = function() {
    $scope.changesMade = true;
  }

  $window.app.editor.on('blockselected', this.updatePropertiesDisplay, this);
  $window.app.editor.on('blockdeselected', this.updatePropertiesDisplay, this);
  $window.app.editor.on('treeselected', this.updatePropertiesDisplay, this);
  $window.app.editor.on('propertieschanged', this.updatePropertiesDisplay, this);  // undo and redo events
  this.updatePropertiesDisplay();
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
    controller: 'PropertyPanelController',
    templateUrl: 'app/property/property-panel.html'
  }
})

/**
 * A directive for a GUI element that contains data about a node property. Consists of a label (which displays the name
 * of the property `propName` and its type `type`), a checkbox input (initially set based on `usesKey`--an empty string
 * for false, nonempty string for true) signifying whether or not the property's value is a board variable reference,
 * and a value, whose representation depends on the given `type`. Separate sets of elements are activated depending on
 * the type of the property and whether or not a key is used. The `value` attribute sets the initial value to display
 * and is a JSON value. If it does not match the given type, no initial value will be set.
 * 
 * The data that this directive holds can be retrieved by invoking the `getContents()` method on the corresponding
 * controller. If any values retrieved are invalid, a notification is sent to the editor, and the value will be 
 * undefined.
 * OUTDATED
 */
.directive('b3Property', function() {
  return {
    restrict: 'E',
    scope: {
      type: "=",  // The type of the property
      value: "=",  // The value of the property
      usesKey: "=",  // Whether or not the property uses a key as its value.
      propName: "=",  // The name of the property to display
      onChange: "&b3OnChange",  // Analogous to oninput event
      onInput: "&b3OnInput"  // Analogous to onchange event
    },
    controller: ["$scope", "$element", "$window", "$compile", 
      function PropertyController($scope, $element, $window, $compile) {
        var this_ = this;

        this.listItemTemplate = '\
          <tr id="list-item">\
            <td id="key">{0}</td>\
            <td><input id="value" type="text" value="{1}" placeholder="jsonValue"></td>\
            <td><a href="#" b3-property-removable2 ng-click="onInput()" list-id="{2}" class="button alert right">-</a></td>\
          </tr>\
        ';

        this.jsonPairTemplate ='\
          <tr>\
            <td><input id="key" type="text" value="{0}" placeholder="key"></td>\
            <td><input id="value" type="text" value="{1}" placeholder="jsonValue"></td>\
            <td><a href="#" propertyremovable ng-click="onInput()" class="button alert right">-</a></td>\
          </tr>\
        ';

        /**
         * Returns an object representing the data contained in the current property. It contains the following keys:
         * * `propName: string` - the name of the property
         * * `type: string` - the type of the property
         * * `usesKey: boolean` - whether or not the `value` is a key.
         * * `value: any` - the actual value of the property.
         * 
         * If any parsing fails, a notification will be displayed in the editor, and the returned value will be
         * `undefined`.
         */
        this.getContents = function() {
          var contents = {};
          contents.name = $scope.propName;
          contents.type = $scope.type;
          contents.usesKey = $scope.usesKeyInput;

          // If a key is being used...
          if ($scope.usesKeyInput) {
            contents.value = $element[0].querySelector("#key").value;
          }  // Otherwise...
          else {
            // Do something according to the type.
            switch ($scope.type) {
              case "string":
                contents.value = $element[0].querySelector("#value-string").value;
                break;
              case "position":
                // FALL THROUGH
              case "vec2":
                contents.value = this._getVec2($scope.type);
                break;
              case "number":
                contents.value = this._parseNumber($element[0].querySelector("#value-number").value);
                break;
              case "entity":
                var number = this._parseNumber($element[0].querySelector("#value-" + $scope.type).value);

                // If the number is an integer...
                if (Number.isInteger(number))
                  contents.value = number;
                else {
                  $window.app.editor.trigger("notification", undefined, {
                    level: "error",
                    message: "Property '" + $scope.propName + "' is not an integer (entity IDs must be integers)."
                  });
                }
                break;
              case "list":
                contents.value = this._getList("#value-list");
                break;
              case "json":
                contents.value = this._getJSON("#value-json");
                break;
              case "table":
                // If the entries are numbered...
                if ($scope.tableIsNumbered) {
                  contents.value = this._getList("#value-table-list");
                }  // Otherwise...
                else {
                  contents.value = this._getJSON("#value-table-json");
                }
                break;
              case "bool":
                // Boolean coersion.
                contents.value = !!$element[0].querySelector("#value-bool").checked;
                break;
            }
          }

          return contents;
        }

        /**
         * Updates the indices contained in the list elements located in the element with ID `listId`.
         * 
         * @param {string} listId the ID of the set of list elements to update
         */
        this.updateIndices = function(listId) {
          var listItems = $element[0].querySelectorAll("#" + listId + " #list-item");

          // For all items in the list...
          for (var i = 0; i < listItems.length; i++) {
            // Update the key.
            listItems[i].querySelector("#key").innerText = "" + i;
          }
        }

        /**
         * Signals to the current controller that a user has changed the content inside of an input. It is best for the
         * programmer to trigger this method through the "onchange" event.
         */
        this.notifyChange = function() {
          $scope.onChange();
        }

        /**
         * Signals to the current controller that a user has interacted with an input. It is best for the programmer to
         * trigger this method through the "oninput" event.
         */
        this.notifyInput = function() {
          $scope.onInput();
        }

        /**
         * Sets the input contents depending on the type. This method assumes that the elements corresponding to the 
         * type of the current property are all defined.
         */
        this._setContents = function() {
          // Update check status.
          $scope.usesKeyInput = $scope.usesKey;

          // If a key is being used...
          if ($scope.usesKeyInput) {
            // Set the key to the value given.
            $element[0].querySelector("#key").setAttribute("value", $scope.value);
          }  // Otherwise, if the value is defined...
          else if ($scope.value) {
            var value = $scope.value;  // Assumed to be valid JSON.

            // Do something according to the type...
            switch ($scope.type) {
              case "bool":
                this._setChecked("#value-bool", value);
                break;
              case "position":
                // FALL THROUGH
              case "vec2":
                this._setVec2($scope.type, value);
                break;
              case "entity":
                this._setInteger($scope.type, value);
                break;
              case "number":
                this._setNumber($scope.type, value);
                break;
              case "list":
                this._setList("value-list", value);
                break;
              case "json":
                this._setJSON("value-json", value);
                break;
              case "table":
                // If the value is an array...
                if (Array.isArray(value)) {
                  // Update the checkbox accordingly (doing it this way b/c ng-model has an unbreakable grip on the 
                  // "checked" attribute).
                  $scope.tableIsNumbered = true;

                  this._setList("value-table-list", value);
                } else {
                  // Update the checkbox accordingly.
                  $scope.tableIsNumbered = false;

                  this._setJSON("value-table-json", value);
                }
                break;
              case "string":
                // If the value is a string...
                if (typeof value === "string") {
                  $element[0].querySelector("#value-string").value = value;
                } else {
                  this._sendPropertySetError("Value is not a string.");
                }
                break;
            }
          }
        }

        /**
         * Sets the "checked" attribute of the first element found by selector `selector` if `value` is a truthy value,
         * unsets it otherwise.
         * @param {string} selector a selector specifying the checkbox to use.
         * @param {*} value the value to use to determine whether the checkbox should be checked or not.
         */
        this._setChecked = function(selector, value) {
          // If the value is truthy...
          if (value) {
            // Mark the checkbox as checked (using any string will make it checked automatically).
            $element[0].querySelector(selector).setAttribute("checked", "");
          } else {
            // Mark the checkbox as unchecked by removing the "checked" attribute.
            $element[0].querySelector(selector).removeAttribute("checked");
          }
        }

        /**
         * Checks if `value` is an array of length 2 and, if so, sets the inputs corresponding to `type` in the current
         * property to contain the value. Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of vec2 value to set
         * @param {*} value the value to which to set the vec2.
         */
        this._setVec2 = function(type, value) {
          // If the value is a proper vec2 (i.e., is an array with length 2)...
          if (Array.isArray(value) && value.length == 2) {
            // Set x and y values.
            $element[0].querySelector("#value-" + type + "-x").value = value[0];
            $element[0].querySelector("#value-" + type + "-y").value = value[1];
          } else {
            this._sendPropertySetError("Value is not an array of length 2.");
          }
        }

        /**
         * Checks if `value` is numeric and, if so, sets the input corresponding to `type` in the current property to
         * contain the value. Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of numeric value to set
         * @param {*} value the value to which to set the number
         */
        this._setNumber = function(type, value) {
          // If the value is a number...
          if (typeof value === "number") {
            $element[0].querySelector("#value-" + type).value = value;
          } else {
            this._sendPropertySetError("Value is not a number.");
          }
        }

        /**
         * Checks if `value` is an integer and, if so, sets the input corresponding to `type` in the current property to
         * contain the value. Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of integer value to set
         * @param {*} value the value to which to set the number
         */
        this._setInteger = function(type, value) {
          // If the value is an integer
          if (Number.isInteger(value)) {
            $element[0].querySelector("#value-" + type).value = value;
          } else {
            this._sendPropertySetError("Value is not a number.");
          }
        }

        /**
         * Checks if `value` is an array and, if so, uses it to build a corresponding list of inputs (already filled in)
         * contained within the element with ID `id`. Otherwise, sends an error to the editor GUI and does nothing to
         * the input.
         * 
         * @param {string} id the ID of the list element into which the values will be fed
         * @param {*} value the value to use as the basis for building the list
         */
        this._setList = function(id, value) {
          // If the value is an array...
          if (Array.isArray(value)) {
            // For each item in value...
            value.forEach(item => {
              $scope.addListItem(id, item);  // Add the list item.
            });
          } else {
            this._sendPropertySetError("Value is not an array.");
          }
        }

        /**
         * Checks if `value` is an object and, if so, uses it to build a corresponding editable dictionary (already
         * filled in) contained within the element with ID `id`. Otherwise, sends an error to the editor GUI and does
         * nothing to the input.
         * 
         * @param {string} id the ID of the list element into which the values will be fed
         * @param {*} value the value to use as the basis for building the dictionary
         */
        this._setJSON = function(id, value) {
          // If the value is an object but not an array...
          if (typeof value === "object" && !Array.isArray(value)) {
            // For each key-value pair in value...
            for (var key in value) {
              // Add the corresponding key-value pair.
              $scope.addJSONPair(id, key, value[key]);
            }
          } else {
            this._sendPropertySetError("Value is not an object.");
          }
        }

        /**
         * Sends a message to the editor about an error that occurred while setting a property.
         * 
         * @param {string} msg the message to send
         */
        this._sendPropertySetError = function(msg) {
          $window.app.editor.trigger("notification", undefined, {
            level: "error",
            message: "Failed to set value for property '" + $scope.propName + "'. <br>" + msg
          });
        }

        /**
         * Attempts to JSON-parse a property with value `value`. If parsing succeeds, the parsed value is returned. 
         * Otherwise, `undefined` is returned, and a pop-up error is displayed in the editor. If `propExtra` is defined,
         * it is displayed in the error message. If `value` is an empty string, the function simply returns `undefined`
         * instead.
         * 
         * @param {string} value the value of the property being parsed
         * @param {string?} propExtra (optional) extra information to display about where the error occurred.
         * @returns the parsed value, or `undefined` if parsing fails
         */
        this._parseProperty = function(value, propExtra) {
          var result = undefined;

          if (value) {
            // If propExtra is defined, prepend it with a dot. Otherwise, use an empty string.
            var propLocator = propExtra !== undefined ? ("." + propExtra) : '';

            try {
              result = JSON.parse(value);
            } catch (err) {
              $window.app.editor.trigger('notification', undefined, {
                level: 'error',
                message: 'Invalid JSON value in property \'' + $scope.propName + propLocator + '\'. <br>' + err
              });
            }
          }

          return result;
        }

        /**
         * Attempts to parse the value `value` as a number. If parsing fails, an error is shown in the editor, and the 
         * function returns `undefined`.
         * 
         * @param {string} value the value to parse
         * @returns the parsed number, or `undefined` if parsing fails.
         */
        this._parseNumber = function(value) {
          var newValue = Number(value);
          var result;

          // If `value` could be converted to a number...
          if (!isNaN(newValue)) {
            result = newValue;
          } else {
            $window.app.editor.trigger('notification', undefined, {
              level: 'error',
              message: 'Property \'' + $scope.propName + '\' is not a number.'
            });
            result = undefined;
          }

          return result;
        }

        /**
         * Finds all elements with the selector `baseSelector + " #list-item #value"`, parses their contents, and 
         * returns a list of the aforementioned parsed contents. If parsing fails for any value, then that value is 
         * ignored, and a notification is sent to the editor GUI.
         * 
         * @param {string} baseSelector the ID of the table to get the list from
         * @returns a list containing the individual values in the list of inputs `baseSelector`, parsed
         */
        this._getList = function(baseSelector) {
          var values = [];

          // Get all the elements with this selector.
          var domValues = $element[0].querySelectorAll(baseSelector + " #list-item #value");

          // For each value on the DOM (enumerated)...
          for (var i = 0; i < domValues.length; i++) {
            // Parse the value and add the result if defined.
            var parsed = this._parseProperty(domValues[i].value, i);

            if (parsed)
              values.push(parsed);
          }

          return values;
        }

        /**
         * Finds all keys and values in the table with selector `baseSelector`, and returns an object where each key
         * corresponds to a parsed value. If a key is not defined, it is ignored. If a key is defined multiple times,
         * the last corresponding value will be used. If parsing fails for any value, then that value is ignored, and a
         * notification is sent to the editor GUI.
         * 
         * @param {string} baseSelector the ID of the table from which to get the JSON
         * @returns an object extracted from the list of key-value pairs in the table with selector `baseSelector`
         */
        this._getJSON = function(baseSelector) {
          var kvPairs = {};

          // Get all the elements with this selector.
          var domKeys = $element[0].querySelectorAll(baseSelector + " #key");
          var domValues = $element[0].querySelectorAll(baseSelector + " #value");

          // For each key-value pair on the DOM (enumerated)...
          for (var i = 0; i < domValues.length; i++) {
            // If the key is defined...
            if (domKeys[i].value) {
              // Parse the value and set the corresponding key to that value.
              kvPairs[domKeys[i].value] = this._parseProperty(domValues[i].value, domKeys[i].value);
            }
          }

          return kvPairs;
        }

        /**
         * Attempts to parse the inputs in the two components corresponding to the vec2 value of type `type`. If either
         * value cannot be parsed, the function triggers an error notification on the GUI and returns `undefined`.
         * Otherwise, it returns an array representing a vec2.
         * 
         * @param {string} type the type of vec2 to get
         * @returns an array representing a vec2 from the DOM, or `undefined` if either value is invalid.
         */
        this._getVec2 = function(type) {
          var xValue = this._parseProperty($element[0].querySelector("#value-" + type + "-x").value, "x");
          var yValue = this._parseProperty($element[0].querySelector("#value-" + type + "-y").value, "y");
          var result;

          // If both values are defined (i.e., the parsin succeeded)...
          if (xValue !== undefined && yValue !== undefined) {
            result = [xValue, yValue];
          } else {
            result = undefined;
          }

          return result;
        }

        /**
         * Inserts a list item into the current element's list. Only appropriate if `$scope.type` is `list` or `table`.
         * 
         * @param {string} id the ID of the target list element
         * @param {*} value (optional) the value of the list item to insert
         */
        $scope.addListItem = function(id, value) {
          // If the value is undefined...
          if (value === undefined)
            value = '';  // Set it to null so that it isn't displayed.
          else  // Otherwise...
            // Convert to stringified JSON; HTML escape quotes and apostrophes.
            value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");

          // Get list element (jqLite wrapped).
          var listElement = angular.element($element[0].querySelector("#" + id));

          // Create list item template based on the current index, value, and ID.
          var template = this_.listItemTemplate.format(listElement.children().length - 1, value, id);

          // Compile and append template to the list.
          listElement.append($compile(template)($scope));
        }

        /**
         * Inserts a JSON key-value pair into the current element's list. Only appropriate if `$scope.type` is `json`
         * or `table`.
         * 
         * @param {string} id the ID of the target JSON element
         * @param {string} key (optional) the key of the JSON item to set
         * @param {*} value (optional) the value of the JSON item to insert
         */
        $scope.addJSONPair = function(id, key, value) {
          // If the key is undefined...
          if (key === undefined)
            key = '';
          // If the value is undefined...
          if (value === undefined)
            value = '';  // Set it to null so that it isn't displayed.
          else  // Otherwise...
            // Convert to stringified JSON; HTML escape quotes and apostrophes.
            value = JSON.stringify(value).replace(/["]/g, "&quot;").replace(/['"']/g, "&apos;");

          // Get JSON element (jqLite wrapped).
          var jsonElement = angular.element($element[0].querySelector("#" + id));

          // Create list item template.
          var template = this_.jsonPairTemplate.format(key, value);

          // Compile and append template to the list.
          jsonElement.append($compile(template)($scope));
        }

        $scope.showContents = function() {
          console.log(JSON.stringify(this_.getContents()));
        }

        this._setContents();
      }
    ],
    templateUrl: "app/property/property.html"
  }
})

.directive('b3PropertyRemovable2', function() {
  return {
    restrict: 'A',
    scope: {
      listId: "@"
    },
    link: function(scope, element, attrs) {
      element.bind('click', function() {
        // Get the controller corresponding to the b3-property directive.
        var propertyCtrl = angular.element(element[0].closest("b3-property")).controller("b3Property");
        element.parent().parent().remove();  // Remove the current element.
        propertyCtrl.updateIndices(scope.listId);  // Update the indices through the controller.
      });
    }
  };
})

.directive('b3PropertyChangeListener', function() {
  return {
    restrict: 'A',
    link: function(scope, element) {
      // element.bind('change', function() {
      //   // Get the controller corresponding to the b3-property directive.
      //   var propertyCtrl = angular.element(element[0].closest("b3-property")).controller("b3Property");
      //   propertyCtrl.notifyChange();  // Notify of a change in the content.
      // });

      element.bind('input', function() {
        // Get the controller corresponding to the b3-property directive.
        var propertyCtrl = angular.element(element[0].closest("b3-property")).controller("b3Property");
        propertyCtrl.notifyInput();  // Notify of a reception of user input.
      });
    }
  }
});
