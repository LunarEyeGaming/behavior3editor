angular.module("app.textInput", [])

/**
 * A more general-purpose directive for a text input.
 * The formatter function is called immediately on input change with the current input provided as an argument and
 * should return an object containing the following:
 * * `isValid: boolean` - whether or not the current input is valid and should be accepted.
 * * `result: any` - the new value to return. Should be defined if and only if `isValid` is true.
 * * `alert: {level: string, message: string}` - an object containing a `level` ("warning" or "error") and a `message`
 *   (the message to display). This field is optional and can be defined regardless of whether or not `isValid` is true.
 * This is accomplished through the $scope.updateAlert() function, which updates the alert to display based on the 
 * result of the formatter function.
 * The formatter function is similarly called when the `requestValue()` method is called. The `requestValue()` method
 * returns a value similar in schema to the expected result of the formatter function even if said function is 
 * undefined. See corresponding documentation for more details.
 */
.directive("b3TextInput", function() {
  return {
    restrict: "E",
    scope: {
      initialValue: "=",  // Initial value in the input (must be a stringified JSON value). TODO: set to "=value"
      // TODO: remove b3 prefix
      onChange: "&b3OnChange",  // What to do on changing the input value. This occurs immediately after the input value
      // changes
      formatter: "&b3Formatter",  // Called immediately on input change.
      placeholder: "@",  // The placeholder to use for the input field.
      expandable: "@"  // Whether or not the input should have a "Show More" button
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

        // TODO: $watch function call is obsolete. Move body out of $watch call.
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
              formatter: (input) => $scope.formatter({input})
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

.controller("ExpandedTextController", function($scope, close, value, returnContentsCallback, formatter) {
  $scope.value = value;

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