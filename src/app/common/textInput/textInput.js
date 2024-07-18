angular.module("app.textInput", [])

/**
 * A service for numerous formatter functions to be used with the `b3TextInput` directive.
 */
.factory("b3Format", function($window) {
  var b3Format = {};

  /**
   * The returned value is an object matching the schema provided in the `b3TextInput` directive's documentation.
   * `isValid` is true if either `value` is an empty string or parsing the value is successful. `result` is the
   * result of parsing the value if parsing is successful or `value` is an empty string. Otherwise, it is `undefined`.
   * If parsing fails, `alert` will be defined to be an object with `level` "error" and a `message` containing why the 
   * parsing failed.
   * 
   * @param {string} value the value to validate
   * @returns an object. See method documentation body for more information.
   */
  b3Format.parseJson = function(value) {
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
   * The returned value is an object matching the schema provided in the `b3TextInput` directive's documentation.
   * `isValid` is true if `value` is a non-empty string that does not match the name of a node or opened tree in the 
   * editor (except for the current tree). `result` is the given `value` if `isValid` is `true` and `undefined`
   * otherwise. An alert is given to display the status of the value.
   * 
   * @param {Tree} currentTree the current tree being edited
   * @param {string} value the value to validate
   * @returns an object. See method documentation body for more information.
   */
  b3Format.inspectTreeTitle = function(currentTree, value) {
    var result;

    // If the value is empty...
    if (value.length == 0) {
      result = {
        isValid: false,
        result: undefined,
        alert: {level: "error", message: "Title cannot be empty."}
      };
    }
    // Otherwise, if a node with name `value` already exists and it is not the name of the currently edited tree since
    // it was last saved...
    else if ($window.app.editor.nodes[value] && value != currentTree.nameSinceLastSave) {
      result = {
        isValid: false,
        result: undefined,
        alert: {level: "error", message: "Node name already used."}
      };
    }
    else {
      // Returns whether or not there is a tree with the same name as `value` and an ID not matching that of the
      // current tree.
      var matchesOtherTree = $window.app.editor.trees.some(otherTree => 
        otherTree.blocks[0].title == value && currentTree.id != otherTree.id
      );

      if (matchesOtherTree) {
        result = {
          isValid: false,
          result: undefined,
          alert: {level: "error", message: "Tree name already used."}
        };
      } else {
        result = {
          isValid: true,
          result: value,
          alert: {level: "success", message: "Tree name not taken."}
        };
      }
    }

    return result;
  }

  return b3Format;
})

/**
 * A more general-purpose directive for a text input. Includes the ability to transform and validate the initial input
 * data using the `formatter` callback and an option for a "Show More" button (which opens a modal containing the
 * current contents in a bigger text box), which is set using the `expandable` attribute. The initial value to use is
 * given by a scope binding in the `value` attribute. The `placeholder` attribute determines the placeholder to use for
 * the text box. `read-only` determines whether or not the input is read-only, which means that the input cannot be 
 * edited.
 * 
 * The `formatter` function is called immediately on input change with the current input provided as an argument and
 * should return an object containing the following:
 * * `isValid: boolean` - whether or not the current input is valid and should be accepted.
 * * `result: any` - the new value to return. Should be defined if and only if `isValid` is true.
 * * `alert: {level: string, message: string}` - an object containing a `level` ("success", "warning" or "error") and a
 *   `message` (the message to display). This field is optional and can be defined regardless of whether or not 
 *   `isValid` is true.
 * This is accomplished through the $scope.updateAlert() function, which updates the alert to display based on the 
 * result of the `formatter` function.
 * 
 * The `formatter` function is similarly called when the `requestValue()` method is called. The `requestValue()` method
 * returns a value similar in schema to the expected result of the formatter function even if said function is 
 * undefined. See corresponding documentation for more details.
 */
.directive("b3TextInput", function() {
  return {
    restrict: "E",
    scope: {
      initialValue: "=value",  // Initial value in the input.
      onChange: "&",  // What to do on changing the input value. This occurs immediately after the input value changes
      formatter: "&",  // Called immediately on input change.
      placeholder: "@",  // The placeholder to use for the input field.
      expandable: "@",  // Whether or not the input should have a "Show More" button
      readOnly: "@"  // Whether or not the input is read-only
    },
    controller: ["$scope", "$window", "ModalService", 
      function TextInputController($scope, $window, ModalService) {
        var this_ = this;

        /**
         * Returns an object with the following schema:
         * * `isValid: boolean` - whether or not the current input is valid and should be accepted. Will always be true
         *   if no `formatter` is set
         * * `value: any` - the value returned. undefined if `isValid` is false.
         * * `invalidMessage: string` - the reason why the value is invalid. Defined if and only if `isValid` is false.
         * 
         * @returns an object. See documentation above.
         */
        this.requestValue = function() {
          var result = {};

          // Invoke the formatter function (which is always defined due to AngularJS' handling of "&" binding).
          var formatResponse = $scope.formatter({input: $scope.value});

          // If a response was given...
          if (formatResponse !== undefined) {
            result.isValid = formatResponse.isValid;

            // If the current value is valid...
            if (formatResponse.isValid) {
              result.value = formatResponse.result;
            } else {
              result.invalidMessage = formatResponse.alert.message;
            }
          } else {
            result.isValid = true;
            result.value = $scope.value;
          }

          return result;
        }

        /**
         * Sets the current value to `value`.
         * 
         * @param {string} value the value to set
         */
        this.setValue = function(value) {
          $scope.value = value;
          $scope.onChange();
          $scope.updateAlert();
        }

        $scope.valueIsValid = true;  // Must be, by default, valid.

        $scope.$watch("initialValue", function() {
          $scope.value = $scope.initialValue || "";
        });

        /**
         * Shows a modal to display the text in a larger text box.
         */
        $scope.expandText = function() {
          ModalService.showModal({
            templateUrl: "app/common/textInput/modal-expanded-text.html",
            controller: "ExpandedTextController",
            inputs: {
              value: $scope.value,
              returnContentsCallback: (value) => this_.setValue(value),
              formatter: (input) => $scope.formatter({input}),
              readOnly: $scope.readOnly
            }
          });
        }

        /**
         * Debug function that logs the current text value.
         */
        $scope.getValue = function() {
          var v = this_.requestValue();

          // If the returned value is defined...
          if (v !== undefined) {
            console.log(v);
          } else {
            console.log("Text value not defined");
          }
        }

        /**
         * Updates the alert to show based on the result of `$scope.formatter()`.
         */
        $scope.updateAlert = function() {
          // Invoke the formatter function (which is always defined due to AngularJS' handling of "&" binding).
          var formatResponse = $scope.formatter({input: $scope.value});
          // If a response was given...
          if (formatResponse !== undefined) {
            // Update the alert
            $scope.inputAlert = formatResponse.alert;
          }
        }
      }
    ],
    templateUrl: "app/common/textInput/textInput.html"
  }
})

.controller("ExpandedTextController", function($scope, close, value, returnContentsCallback, formatter, readOnly) {
  $scope.value = value;
  $scope.readOnly = readOnly;

  $scope.close = function(result) {
    close(result);
  }

  $scope.saveContents = function() {
    returnContentsCallback($scope.value);
  }

  /**
   * Updates the alert to show based on the result of `$scope.formatter()`.
   */
  $scope.updateAlert = function() {
    // Invoke the formatter function (which is always defined due to AngularJS' handling of "&" binding).
    var formatResponse = formatter($scope.value);
    // If a response was given...
    if (formatResponse !== undefined) {
      // Update the alert
      $scope.inputAlert = formatResponse.alert;
    }
  }
});