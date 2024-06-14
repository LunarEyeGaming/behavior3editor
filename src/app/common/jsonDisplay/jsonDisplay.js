angular.module("app.jsonDisplay", [])

.directive("b3JsonInput", function() {
  return {
    restrict: "E",
    scope: {
      initialValue: "=",  // Initial value in the input (must be a stringified JSON value). TODO: set to "=value"
      onChange: "&b3OnChange"  // What to do on changing the input value. This occurs immediately after the input value
                               // changes
    },
    controller: ["$scope", "$window", "ModalService", 
      function JsonInputController($scope, $window, ModalService) {
        var this_ = this;

        /**
         * Returns the result of parsing the current value, if it is a non-empty string. Otherwise, returns `undefined`.
         * 
         * @returns the parsed JSON value, or `undefined` if the current value is an empty string.
         * @throws an error if parsing fails
         */
        this.getValue = function() {
          var result = undefined;

          // If the value is a non-empty string...
          if ($scope.value)
            result = JSON.parse($scope.value);

          return result;
        }

        /**
         * Sets the current value to `value`.
         * 
         * @param {string} value the value to set
         */
        this.setValueStr = function(value) {
          $scope.value = value;
          $scope.onChange();
        }

        /**
         * Sets the current value to a string representation of `value`.
         * 
         * @precondition `value !== undefined`
         * @param {*} value the JSON value to use
         */
        this.setValue = function(value) {
          $scope.value = JSON.stringify(value);
        }

        $scope.$watch("initialValue", function() {
          $scope.value = $scope.initialValue || "";
        });

        /**
         * Shows a modal to display the JSON in a larger text box.
         */
        $scope.expandJson = function() {
          ModalService.showModal({
            templateUrl: "app/common/jsonDisplay/modal-expanded-json.html",
            controller: "ExpandedJsonController",
            inputs: {
              value: $scope.value,
              returnContentsCallback: (value) => this_.setValueStr(value)
            }
          });
        }

        /**
         * Debug function that logs the current JSON value.
         */
        $scope.getValue = function() {
          var v = this_.getValue();

          // If the returned value is defined...
          if (v !== undefined) {
            console.log(JSON.stringify(v));
          } else {
            console.log("JSON value not defined");
          }
        }
      }
    ],
    templateUrl: "app/common/jsonDisplay/jsonDisplay.html"
  }
})

.controller("ExpandedJsonController", function($scope, close, value, returnContentsCallback) {
  $scope.value = value;

  $scope.close = function(result) {
    close(result);
  }

  $scope.saveContents = function() {
    returnContentsCallback($scope.value);
  }
});