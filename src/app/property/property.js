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

  // SELECTION/DESELECTION
  $scope.block = null;
  this.updatePropertiesDisplay = function() {
    // Before switching, trigger $scope.editProperties() to update the node properties.
    $scope.editProperties();

    var selectedBlocks = $window.app.editor.selectedBlocks;
    var properties = undefined;
    var outputs = undefined;
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

        this_.propertyTable.html('');
        var domName = document.querySelector('#property-panel #name');
        var domTitle = document.querySelector('#property-panel #title');

        domName.value = block.name;
        domTitle.value = block.title || '';

        properties = [];

        // Add properties from node prototype to be used by ng-repeat. This has no effect when the block is the root.
        for (var name in block.node.prototype.properties) {
          var prop = {};
          prop.name = name;
          prop.type = block.node.prototype.properties[name].type;

          // If the block has a corresponding entry for the property...
          if (block.properties[name] != undefined) {
            prop.key = block.properties[name].key;
            prop.value = block.properties[name].value;
          }

          properties.push(prop);
        }

        // If the block is the root...
        if (block.type == 'root') {
          // Add root properties.
          for (var name in block.properties) {
            $scope.addRootProperty(name, block.properties[name]);
          }
        }

        if (block.type == 'action') {
          outputs = [];

          for (var name in block.node.prototype.output) {
            var output = {};
            output.name = name;
            output.type = block.node.prototype.output[name].type;

            // If the block has a corresponding entry for the property...
            if (block.output[name] != undefined) {
              output.key = block.output[name].key;
            }

            outputs.push(output);
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
        $scope.outputs = outputs;
        $scope.screen = screen;
      });
    }, 0, false);
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
        var propertyData = propertyCtrl.getContents();

        // If the data has a defined key or value...
        if (propertyData.key !== undefined || propertyData.value !== undefined)
          // Add to new node.
          newNode.properties[propertyData.name] = {
            type: propertyData.type,
            key: propertyData.key,
            value: propertyData.value
          };
      });
    }

    if ($scope.block.type == 'action') {
      // Get the property data from the controllers corresponding to the properties.
      var domOutputs = document.querySelectorAll("b3-property#property-panel-output");

      newNode.output = {};

      domOutputs.forEach(output => {
        // Get controller.
        var propertyCtrl = angular.element(output).controller("b3Property");

        // Get property data.
        var outputData = propertyCtrl.getContents();

        // If the data has a defined non-empty key...
        if (outputData.key)
          // Add to new node.
          newNode.output[outputData.name] = {
            type: outputData.type,
            key: outputData.key
          };
      });
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
 * A directive for displaying different input forms depending on the type of the node property (and whether or not the 
 * property uses a key). It is used by the properties panel to allow the user to edit the arguments to supply to the
 * nodes and by the addnode and editnode modals to allow the user to edit the properties that the node has. Whether or
 * not the elements for editing the node name and node type can be displayed is configured through the `editable` 
 * attribute, which evaluates to true if defined and a non-empty string and false otherwise. If `editable` is false,
 * then these elements are replaced with a display for the name and type of the property.
 * 
 * The `b3-property`'s initial fields are set through the `type`, `key`, `value`, and `name` attributes respectively.
 * `name` is the name of the property and `type` is the type of the property. `value` indicates the raw value to use,
 * and `key` indicates the board variable to look up for the value. `key` and `value` are mutually exclusive, and if
 * both are defined, then `key` is used instead. All of these attributes take in expressions to evaluate in the outside
 * scope, and the directive autofills the inputs depending on these fields. As an intermediary step, a slight conversion
 * is made. If `key` is used, then `usesKey` is true and `value` is set to the contents of `key`. Otherwise, `usesKey`
 * is false and `value` is set to the new value.
 * The `b3-property`'s initial fields are set through the `type`, `value`, `usesKey`, and `name` attributes 
 * respectively. All of these attributes take in expressions to evaluate in the outside scope, and the directive 
 * autofills the inputs depending on these fields. If `usesKey` is false, the `value` must have the right format for the
 * `type`, or an error will be sent to the editor GUI and autofill will not take place. If `usesKey` is true, then the
 * `value` attribute instead represents a board variable to look up, so the prompt will always be a single text field in
 * that case regardless of type. `usesKey` and the current value can be modified by the user through the checkbox
 * labeled "Key" and the input element(s) respectively. The following are the types and descriptions of the
 * corresponding `value` formats as well as the form of the input element(s):
 * * `string`: Any string. The input prompt is a single text field with a checkbox indicating whether or not a string
 *   should be defined.
 * * `vec2`: An array of length 2. The input prompt is two text fields labeled "X" and "Y" respectively.
 * * `position`: An array of length 2. The input prompt is two text fields labeled "X" and "Y" respectively.
 * * `bool`: A boolean. The input prompt is a checkbox.
 * * `number`: A number. The input prompt is a single text field.
 * * `entity`: An integer signifying the ID of an entity. The input prompt is a single text field.
 * * `list`: An array. The input prompt is an interactive GUI for adding and removing list items, which are raw JSON 
 *   values
 * * `table`: An array or a dictionary / object. The input prompt has a checkbox indicating whether or not the entries
 *   are numbered. If they not numbered, they are described by keys given in text fields. Otherwise, the prompt is 
 *   identical to that of a `list` prompt. The values must contain valid JSON.
 * * `json`: Any valid JSON value. The input prompt has a dropdown menu describing the sub-type (boolean, dictionary, 
 *   list, null, number, and string) and a second field that changes according to this sub-type. The second field is
 *   identical in appearance to the `bool`, `table` (if not numbered), `list`, `number`, and `string` prompts when the
 *   sub-type is boolean, dictionary, list, number, and string respectively. The null subtype has no second field.
 * 
 * In addition, the value can be set to `null` to signify that the input should not be autofilled, except for when the
 * type is `json`, in which case the sub-type is set to null. Similarly, if a string is `null`, then the checkbox for
 * whether or not to include a string is left unticked.
 * 
 * The current contents of a `b3-property` can be retrieved through the `getContents()` method of the corresponding
 * controller. The `updateIndices()` method (used solely for list fields) requests the controller to update the indices
 * of the list fields.
 * 
 * The `isOutput` attribute determines whether or not the property element is an output. By default, the attribute
 * evaluates to false because it is undefined. If `isOutput` evaluates to true, then the autofiller expects a `key` to
 * be provided.
 */
.directive('b3Property', function() {
  // TODO: Refactor for consistency.
  return {
    restrict: 'E',
    scope: {
      initialType: "=type",  // The initial type of the property
      initialValue: "=value",  // The initial value of the property
      initialKey: "=key",  // The initial key of the property. Has higher precedence than value.
      initialName: "=name",  // The name of the property to display
      onChange: "&b3OnChange",  // Analogous to oninput event
      onInput: "&b3OnInput",  // Analogous to onchange event
      editable: "@",  // Whether or not the name and type can be edited.
      isOutput: "@"  // Whether or not the property element is an output
    },
    controller: ["$scope", "$element", "$window", "$compile", "$timeout", 
      function PropertyController($scope, $element, $window, $compile, $timeout) {
        var this_ = this;

        this.listItemTemplate = '\
          <tr id="list-item">\
            <td id="key">{0}</td>\
            <td>\
              <b3-text-input id="value" onblur="element(this).onChange(this)" b3-on-change="onInput()"\
                             placeholder="jsonValue" b3-formatter="parseJson(input)" expandable="a">\
              </b3-text-input>\
            </td>\
            <td>\
              <a href="#" b3-property-removable2 ng-click="onInput()" list-id="{2}" class="button alert right">-</a>\
            </td>\
          </tr>\
        ';

        this.dictPairTemplate ='\
          <tr>\
            <td><input id="key" type="text" value="{0}" placeholder="key"></td>\
            <td>\
              <b3-text-input id="value" onblur="element(this).onChange(this)" b3-on-change="onInput()"\
                             placeholder="jsonValue" b3-formatter="parseJson(input)" expandable="a">\
              </b3-text-input>\
            </td>\
            <td><a href="#" propertyremovable ng-click="onInput()" class="button alert right">-</a></td>\
          </tr>\
        ';

        /**
         * Returns an object representing the data contained in the current property. It contains the `name` of the 
         * property as well as its `type`, `key` reference, and `value` reference (with `key` and `value` being mutually
         * exclusive).
         * 
         * If any parsing fails, a notification will be displayed in the editor, and the returned `value` will be
         * `undefined`.
         */
        this.getContents = function() {
          var contents = {};
          contents.name = $scope.name;
          contents.type = $scope.type;

          // If a key is being used...
          if ($scope.usesKey) {
            contents.key = $element[0].querySelector("#key").value;
          }  // Otherwise...
          else {
            // Do something according to the type.
            switch ($scope.type) {
              case "string":
                // If a string is defined...
                if ($scope.stringIsDefined)
                  contents.value = this._requestTextInputValue(this._getController("#value-string", "b3TextInput"));

                break;
              case "position":
                // FALL THROUGH
              case "vec2":
                contents.value = this._getVec2($scope.type);
                break;
              case "number":
                contents.value = this._requestTextInputValue(this._getController("#value-number", "b3TextInput"));
                break;
              case "entity":
                contents.value = this._requestTextInputValue(this._getController("#value-entity", "b3TextInput"));
                break;
              case "list":
                // If a list is defined...
                if ($scope.listIsDefined)
                  contents.value = this._getList("#value-list");

                break;
              case "json":
                contents.value = this._getJSON();
                break;
              case "table":
                // If a table is defined...
                if ($scope.tableIsDefined) {
                  // If the entries are numbered...
                  if ($scope.tableIsNumbered) {
                    contents.value = this._getList("#value-table-list");
                  }  // Otherwise...
                  else {
                    contents.value = this._getDict("#value-table-dict");
                  }
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
         * type of the current property are all defined. This method also initializes some scope fields that are used
         * later. If the type of the given initial value does not conform to the given initial type, then autofilling
         * does not take place and an error is sent to the editor GUI. An undefined type string defaults to "json".
         */
        this._setContents = function() {
          $scope.type = $scope.initialType || "json";
          $scope.name = $scope.initialName;

          // This dictionary is necessary because b3-text-input elements aren't compiled until after this function runs,
          // and setAttribute has no effect on b3-text-input elements as far as I know.
          $scope.typedValues = {};

          // If the initial key is defined as a nonempty string or the property is an output...
          if ($scope.initialKey || $scope.isOutput) {
            $scope.usesKey = true;
            $scope.value = $scope.initialKey;
          } else {
            $scope.usesKey = false;
            $scope.value = $scope.initialValue;
          }

          // If a key is being used...
          if ($scope.usesKey) {
            // If the key is not null or undefined...
            if ($scope.value != undefined)
              // Set the key to the value given.
              $element[0].querySelector("#key").setAttribute("value", $scope.value);
          }  // Otherwise, if the value is defined...
          else if ($scope.value !== undefined) {
            // Do something according to the type
            switch ($scope.type) {
              case "bool":
                this._setChecked("#value-bool", $scope.value);
                break;
              case "position":
                // FALL THROUGH
              case "vec2":
                // If the value is not null...
                if ($scope.value !== null)
                  this._setVec2($scope.type, $scope.value);
                break;
              case "entity":
                // If the value is not null...
                if ($scope.value !== null)
                  this._setEntity($scope.type, $scope.value);
                break;
              case "number":
                // If the value is not null...
                if ($scope.value !== null)
                  this._setNumber($scope.type, $scope.value);
                break;
              case "list":
                // If the value is not null...
                if ($scope.value !== null) {
                  $scope.listIsDefined = true;

                  this._setList("list", $scope.value);
                } else {
                  $scope.listIsDefined = false;
                }
                break;
              case "table":
                // If the value is not null...
                if ($scope.value !== null) {
                  $scope.tableIsDefined = true;

                  // If the value is an array...
                  if (Array.isArray($scope.value)) {
                    // Update the checkbox accordingly (doing it this way b/c ng-model has an unbreakable grip on the 
                    // "checked" attribute).
                    $scope.tableIsNumbered = true;

                    this._setList("tableList", $scope.value);
                  } else {
                    // Update the checkbox accordingly.
                    $scope.tableIsNumbered = false;

                    this._setDict("tableDict", $scope.value);
                  }
                } else {
                  $scope.tableIsDefined = false;
                }
                break;
              case "json":
                this._setJSON($scope.value);
                break;
              case "string":
                // If the value is a string...
                if (typeof $scope.value === "string") {
                  $scope.typedValues.string = $scope.value;
                  $scope.stringIsDefined = true;
                }  // Otherwise, if the string is null...
                else if ($scope.value === null) {
                  $scope.stringIsDefined = false;
                } else {
                  this._sendPropertySetError("Value is not a string", $scope.value);
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
         * Checks if `value` is an array of length 2 and, if so, sets the value corresponding to `type` in the current
         * property to contain the value. Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of vec2 value to set
         * @param {*} value the value to which to set the vec2.
         */
        this._setVec2 = function(type, value) {
          // If the value is a proper vec2 (i.e., is an array with length 2)...
          if (Array.isArray(value) && value.length == 2) {
            // // Set x and y values.
            // this._getController("#value-" + type + "-x", "b3TextInput").setValue(value[0]);
            // this._getController("#value-" + type + "-y", "b3TextInput").setValue(value[1]);
            // Set x and y values (scope values will be looked up by json input element during binding process).
            $scope.typedValues[type] = [JSON.stringify(value[0]), JSON.stringify(value[1])];
            // $element[0].querySelector("#value-" + type + "-x").setAttribute("initial-value", JSON.stringify(value[0]));
            // $element[0].querySelector("#value-" + type + "-y").setAttribute("initial-value", JSON.stringify(value[1]));
          } else {
            this._sendPropertySetError("Value is not an array of length 2", value);
          }
        }

        /**
         * Checks if `value` is numeric and, if so, sets the value corresponding to `type` in the current property.
         * Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of numeric value to set
         * @param {*} value the value to which to set the number
         */
        this._setNumber = function(type, value) {
          // If the value is a number...
          if (typeof value === "number") {
            $scope.typedValues[type] = value;
          } else {
            this._sendPropertySetError("Value is not a number", value);
          }
        }

        /**
         * Checks if `value` represents an integer and, if so, sets the input corresponding to `type` in the current
         * property. Otherwise, sends an error to the editor GUI and does nothing to the inputs.
         * 
         * @param {string} type the type of integer value to set
         * @param {*} value the value to which to set the number
         */
        this._setEntity = function(type, value) {
          // If the value is an integer...
          if (Number.isInteger(value)) {
            $scope.typedValues[type] = value;
          } else {
            this._sendPropertySetError("Value is not an integer", value);
          }
        }

        /**
         * Checks if `value` is an array and, if so, uses it to build a corresponding list of inputs (already filled in)
         * contained within the value with type `type`. Otherwise, sends an error to the editor GUI and does nothing to
         * the input.
         * 
         * @param {string} type the type of list to which to add the elements.
         * @param {*} value the value to use as the basis for building the list
         */
        this._setList = function(type, value) {
          // If the value is an array...
          if (Array.isArray(value)) {
            $scope.typedValues[type] = [];
            // For each item in value...
            value.forEach(item => {
              $scope.typedValues[type].push(JSON.stringify(item));
            });
          } else {
            this._sendPropertySetError("Value is not an array", value);
          }
        }

        /**
         * Checks if `value` is an object and, if so, uses it to build a corresponding editable dictionary (already
         * filled in) contained within the object with type `type`. Otherwise, sends an error to the editor GUI and does
         * nothing to the input.
         * 
         * @param {string} type the type of value to which to add the key-value pairs.
         * @param {*} value the value to use as the basis for building the dictionary
         */
        this._setDict = function(type, value) {
          // If the value is an object but not an array...
          if (typeof value === "object" && !Array.isArray(value)) {
            $scope.typedValues[type] = {};
            // For each key-value pair in value...
            for (var key in value) {
              // Add the corresponding key-value pair.
              $scope.typedValues[type][key] = JSON.stringify(value[key]);
            }
          } else {
            this._sendPropertySetError("Value is not an object", value);
          }
        }

        /**
         * Sets the inputs corresponding to a JSON value (sub-type and corresponding input) depending on the type of 
         * `value` given.
         * 
         * @param {*} value the JSON value to set
         */
        this._setJSON = function(value) {
          // If the value is null...
          if (value === null) {
            // Set subType to "null".
            $scope.subType = "null";
          }  // Otherwise, if the value is a boolean...
          else if (typeof value === "boolean") {
            $scope.subType = "bool";

            this._setChecked("#value-json-bool", value);
          }  // Otherwise, if the value is a number...
          else if (typeof value === "number") {
            $scope.subType = "number";

            this._setNumber("jsonNumber", value);
          }  // Otherwise, if the value is a string...
          else if (typeof value === "string") {
            $scope.subType = "string";

            $scope.typedValues.jsonString = value;
          }  // Otherwise, if the value is an array..
          else if (Array.isArray(value)) {
            $scope.subType = "list";

            this._setList("jsonList", value);
          }  // Otherwise, if the value is an object...
          else if (typeof value === "object") {
            $scope.subType = "dict";

            this._setDict("jsonDict", value);
          } else {
            this._sendPropertySetError("Unknown subtype '" + (typeof value) + "'");
          }
        }

        /**
         * Sends a message to the editor about an error that occurred while setting a property, displaying the value
         * `value`.
         * 
         * @param {string} msg the message to send
         */
        this._sendPropertySetError = function(msg, value) {
          $window.app.editor.trigger("notification", undefined, {
            level: "error",
            message: "Failed to set value for property '" + $scope.name + "'. <br>" + msg + ": " +
              b3editor.escapeHtml(JSON.stringify(value))
          });
        }

        // /**
        //  * Gets the value from the text input controller `controller` and parses it in JSON. If parsing succeeds, the
        //  * parsed value is returned. Otherwise, `undefined` is returned, and a pop-up error is displayed in the editor.
        //  * If `propExtra` is defined, it is displayed in the error message. If `value` is an empty string, the function
        //  * simply returns `undefined` instead.
        //  * 
        //  * @precondition the value returned by `controller` is valid JSON
        //  * @param {TextInputController} controller the controller containing the value of the property being parsed
        //  * @param {string?} propExtra (optional) extra information to display about where the error occurred.
        //  * @returns the parsed value, or `undefined` if parsing fails
        //  */
        // this._parseProperty = function(controller, propExtra) {
        //   var result = undefined;

        //   // If propExtra is defined, prepend it with a dot. Otherwise, use an empty string.
        //   var propLocator = propExtra !== undefined ? ("." + propExtra) : '';

        //   var response = controller.requestValue();

        //   // If the value is valid and defined as a non-empty string...
        //   if (response.validValue && response.value) {
        //     result = JSON.parse(response.value);
        //   }  // Otherwise, if the value is invalid...
        //   else if (!response.validValue) {
        //     // Notify the editor about the error.
        //     $window.app.editor.trigger('notification', undefined, {
        //       level: "error",
        //       message: "Error with property '" + $scope.name + propLocator + "'. <br>" + response.errorMessage
        //     });
        //   }

        //   return result;
        // }

        /**
         * Attempts to get a value from a text input controller `controller`, returning the contained value if valid and
         * relaying the error message to the editor GUI otherwise.
         * 
         * @param {TextInputController} controller the controller from which to reqest the value
         * @param {string?} propExtra (optional) extra information to display about where the error occurred.
         * @returns the value returned by `controller`, or `undefined` if the value is invalid.
         */
        this._requestTextInputValue = function(controller, propExtra) {
          var result = undefined;

          // If propExtra is defined, prepend it with a dot. Otherwise, use an empty string.
          var propLocator = propExtra !== undefined ? ("." + propExtra) : '';

          var response = controller.requestValue();
          // If the value is valid...
          if (response.isValid) {
            result = response.value;
          } else {
            // Notify the editor about the error.
            $window.app.editor.trigger('notification', undefined, {
              level: "error",
              message: "Could not change property '" + $scope.name + propLocator + "'. <br>" + response.invalidMessage
            });
          }

          return result;
        }

        /**
         * Finds all elements with the selector `baseSelector + " #list-item #value"`, retrieves their JSON contents 
         * from their corresponding controllers, and returns a list of the aforementioned parsed contents. If parsing
         * fails for any value, then that value is ignored, and a notification is sent to the editor GUI.
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
            // Get the text input's value and add it if defined.
            var value = this._requestTextInputValue(angular.element(domValues[i]).controller("b3TextInput"), i);

            if (value !== undefined)
              values.push(value);
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
        this._getDict = function(baseSelector) {
          var kvPairs = {};

          // Get all the elements with this selector.
          var domKeys = $element[0].querySelectorAll(baseSelector + " #key");
          var domValues = $element[0].querySelectorAll(baseSelector + " #value");

          // For each key-value pair on the DOM (enumerated)...
          for (var i = 0; i < domValues.length; i++) {
            // If the key is defined and a non-empty string...
            if (domKeys[i].value) {
              var inputCtrl = angular.element(domValues[i]).controller("b3TextInput");
              // Get the text input's value and set the corresponding key to that value.
              kvPairs[domKeys[i].value] = this._requestTextInputValue(inputCtrl, domKeys[i].value);
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
          var xValue = this._requestTextInputValue(this._getController("#value-" + type + "-x", "b3TextInput"), "x");
          var yValue = this._requestTextInputValue(this._getController("#value-" + type + "-y", "b3TextInput"), "y");
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
         * The "json" type represents a catch-all type inside the behavior editor, so this method gets the data 
         * depending on the set sub-type (selected via an Angular model).
         */
        this._getJSON = function() {
          var result;

          // Do something according to the sub-type.
          switch ($scope.subType) {
            case "string":
              result = this._requestTextInputValue(this._getController("#value-json-string", "b3TextInput"));
              break;
            case "number":
              result = this._requestTextInputValue(this._getController("#value-json-number", "b3TextInput"));
              break;
            case "list":
              result = this._getList("#value-json-list");
              break;
            case "dict":
              result = this._getDict("#value-json-dict");
              break;
            case "bool":
              // Boolean coersion.
              result = !!$element[0].querySelector("#value-json-bool").checked;
              break;
            case "null":
              result = null;
              break;
          }

          return result;
        }

        /**
         * Returns the controller with name `controllerName` corresponding to the first element that matches `selector`.
         * 
         * @param {string} selector the selector to find the element from which to retrieve the controller
         * @param {string} controllerName the name of the controller to get (as in `angularElement.controller()`)
         * @returns the controller with name `controllerName` corresponding to an element that matches `selector`
         */
        this._getController = function(selector, controllerName) {
          return angular.element($element[0].querySelector(selector)).controller(controllerName);
        }

        $scope.subTypes = {
          "dict": "Dictionary",
          "list": "List",
          "number": "Number",
          "bool": "Boolean",
          "string": "String",
          "null": "Null"
        };
        $scope.subType = "null";  // Default sub-type.

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
          var template = this_.listItemTemplate.format(listElement.children().length, value, id);

          // Compile and append template to the list.
          listElement.append($compile(template)($scope));
        }

        /**
         * Inserts a dictionary key-value pair into the current element's list. Only appropriate if `$scope.type` is 
         * `json` or `table`.
         * 
         * @param {string} id the ID of the target JSON element
         * @param {string} key (optional) the key of the JSON item to set
         * @param {*} value (optional) the value of the JSON item to insert
         */
        $scope.addDictPair = function(id, key, value) {
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
          var dictElement = angular.element($element[0].querySelector("#" + id));

          // Create list item template.
          var template = this_.dictPairTemplate.format(key, value);

          // Compile and append template to the list.
          dictElement.append($compile(template)($scope));
        }

        /**
         * The returned value is an object matching the schema provided in the `b3TextInput` directive's documentation.
         * `isValid` is true if either `value` is an empty string or parsing the value is successful. `result` is the
         * result of parsing the value if parsing is successful and `value` is an empty string. Otherwise, it is
         * `undefined`. If parsing fails, `alert` will be defined to be an object with `level` "error" and a `message`
         * containing why the parsing failed.
         * 
         * @param {string} value the value to validate
         * @returns an object. See method documentation body for more information.
         */
        $scope.parseJson = function(value) {
          var result = {};

          // If the value is defined as a non-empty string...
          if (value) {
            // Try to parse the value.
            try {
              var parsed = JSON.parse(value);

              result.isValid = true;
              result.result = parsed;
            } catch (err) {
              // On error, state that the input is invalid and include the reason why parsing failed as an alert.
              result.isValid = false;
              result.alert = {
                level: "error",
                message: "Invalid JSON value: " + err.message
              };
            }
          } else {
            // Mark as valid and make the result undefined.
            result.isValid = true;
            result.result = undefined;
          }

          return result;
        }

        /**
         * Attempts to parse the value `value` as a number. Returns an object containing three possible fields 
         * `isValid`, `result`, and `alert`. The value is considered valid if it represents a valid number or is an
         * empty string. If invalid, an `alert` is given stating that the number is invalid, and the `result` becomes
         * `undefined`. The `result` is also `undefined` if the `value` is an empty string.
         * 
         * @param {string | null | undefined} value the value to parse as a number
         * @returns an object. See method documentation body for more information.
         */
        $scope.parseNumber = function(value) {
          var result = {};
          
          // If `value` is a non-empty string...
          if (value) {
            var newValue = Number(value);

            // If `value` could be converted to a number...
            if (!isNaN(newValue)) {
              result.isValid = true;
              result.result = newValue;
            } else {
              result.isValid = false;
              result.alert = {
                level: "error",
                message: "Property is not a number."
              };
            }
          } else {
            result.isValid = true;
            result.result = undefined;
          }

          return result;
        }

        /**
         * Attempts to parse the value `value` as an entity ID. Returns an object containing three possible fields 
         * `isValid`, `result`, and `alert`. The value is considered valid if it represents a valid entity ID or is an
         * empty string. If invalid, an `alert` is given stating that the ID is invalid, and the `result` becomes
         * `undefined`. The `result` is also `undefined` if the `value` is an empty string.
         * 
         * @param {string | null | undefined} value the value to parse as an entity ID
         * @returns an object. See method documentation body for more information.
         */
        $scope.parseEntity = function(value) {
          var result = {};
          
          // If `value` is a non-empty string...
          if (value) {
            var newValue = Number(value);

            // If `value` could be converted to a number and represents an integer...
            if (!isNaN(newValue) && Number.isInteger(newValue)) {
              result.isValid = true;
              result.result = newValue;
              // Using an entity ID as a number should show a warning.
              result.alert = {
                level: "warning",
                message: "Raw values should not be used for this data type. Use keys instead."
              };
            } else {
              result.isValid = false;
              result.alert = {
                level: "error",
                message: "Property is not a valid entity ID (entity IDs must be integers)."
              };
            }
          } else {
            result.isValid = true;
            result.result = undefined;
          }

          return result;
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
