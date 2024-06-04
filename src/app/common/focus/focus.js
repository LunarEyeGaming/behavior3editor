angular.module('app.focus', [])

/**
 * A directive for an element capable of communicating with "b3Focusable" elements (see corresponding documentation). A
 * b3FocusList has only one "b3Focusable" element that can be focused at a time. The id (or index if unavailable) of the 
 * currently focused element is stored as the "focusedElement" field. All focusable elements except for the currently 
 * focused one will have "isFocused" set to false.
 * The b3FocusList will also call any functions registered through the `bindFocusCallback()` method whenever the focused
 * element changes. It is not recommended that any callbacks registered through this method call the `select()` or
 * `selectById()` methods.
 */
.directive('b3FocusList', function() {
  return {
    transclude: true,
    controller: ['$scope', '$window', function FocusListController($scope, $window) {
      $scope.focusables = [];
      $scope.focusableIds = [];  // Array parallel to focusables
      $scope.focusedElement = null;

      this.focusCallbacks = [];

      // // Variable that should keep the editor from going into an infinite focus change chain.
      // this.isChangingFocus = false;

      /**
       * Sets the current focused element to `focusable`, invokes all callbacks in `focusCallbacks`, and sets the
       * focusable's `isFocused` attribute to `true.`
       * 
       * @param {*} focusable the focusable to select
       */
      this.select = function(focusable) {
        // If the focusedElement is defined...
        if ($scope.focusedElement !== null) {
          // Make previously focused element no longer focused.
          $scope.focusables[$scope.focusedElement].isFocused = false;
        }

        // Set new focusedElement
        $scope.focusedElement = $scope.focusables.indexOf(focusable);

        // Make new focusedElement focused.
        focusable.isFocused = true;

        // // The following code segment is intended to protect from infinite recursion.
        // // If the focus level is not already being changed...
        // if (!this.isChangingFocus) {
        //   this.isChangingFocus = true;

        //   // Trigger callbacks.
        //   this.focusCallbacks.forEach(callback => callback($scope.focusableIds[$scope.focusedElement]));

        //   this.isChangingFocus = false;
        // } else {
        //   throw new EvalError("Emitting 'changefocus' events is not allowed while selecting element to focus.");
        // }

        // Trigger callbacks.
        this.focusCallbacks.forEach(callback => callback($scope.focusableIds[$scope.focusedElement]));
      };

      /**
       * Does the same thing as the `select()` method, except using the ID instead of the `focusable` directly. Has no
       * effect if the current `FocusListController` does not have a focusable corresponding to the ID `focusId`.
       * 
       * @param {string} focusId the ID of the focusable to select
       */
      this.selectById = function(focusId) {
        // Find the index of the focusable to select.
        var focusedElementIdx = $scope.focusableIds.indexOf(focusId);

        // If the focusable was found...
        if (focusedElementIdx != -1)
          this.select($scope.focusables[focusedElementIdx]);
        // Otherwise, do nothing.
      };

      this.addFocusable = function(focusable, id) {
        $scope.focusables.push(focusable);
        $scope.focusableIds.push(id);
        this.select(focusable);
      };

      /**
       * Adds a function to call (passing in the `focusId`) when a focusable is selected.
       * 
       * @param {(string) => void} callback the function to call when a focusable is selected.
       */
      this.bindFocusCallback = function(callback) {
        this.focusCallbacks.push(callback);
      }
    }],
    templateUrl: "app/common/focus/focusList.html"
  }
})

/**
 * A directive for an element that can be focused. Must be the child of an element with the focusList directive. Whether
 * or not the element is "focused" is determined by the namesake field. Clicking inside of this kind of element will 
 * cause it to become focused and all other elements to become unfocused.
 */
.directive('b3Focusable', function($document) {
  return {
    require: "^^b3FocusList",
    transclude: true,
    scope: {},
    link: function(scope, element, _, focusListCtrl) {
      focusListCtrl.addFocusable(scope, element[0].id);

      var isFocused = false;

      $document.on("click", function(e) {
        // If the element that was clicked on is the current element or it is an element inside of the current 
        // element...
        if (element === e.target || element[0].contains(e.target)) {
          // If the focusable is not already focused...
          if (!isFocused) {
            // $apply is needed to make sure that the element updates accordingly.
            scope.$apply(function() {
              // Select this as the focused element.
              focusListCtrl.select(scope);
              isFocused = true;
            });
          }
        } else {
          isFocused = false;
        }
      });
    },
    templateUrl: "app/common/focus/focusable.html"
  }
})

/**
 * A variant of the "focusable" directive that listens for clicks with the target being an element with a particular ID
 * instead of the element that has the directive.
 */
.directive('b3RemoteFocusable', function($document) {
  return {
    require: "^^b3FocusList",
    transclude: true,
    scope: {
      focusId: "@"
    },
    link: function(scope, ownElement, _, focusListCtrl) {
      var element = document.getElementById(scope.focusId);

      focusListCtrl.addFocusable(scope, ownElement[0].id);
      
      var isFocused = false;
      $document.on("click", function(e) {
        // If the element that was clicked on is the current element or it is an element inside of the current 
        // element...
        if (element === e.target || element.contains(e.target)) {
          // If the focusable is not already focused...
          if (!isFocused) {
            // $apply is needed to make sure that the element updates accordingly.
            scope.$apply(function() {
              // Select this as the focused element.
              focusListCtrl.select(scope);
              isFocused = true;
            });
          }
        } else {
          isFocused = false;
        }
      });
    },
    templateUrl: "app/common/focus/focusable.html"
  }
})

/**
 * A directive that allows the editor to talk with a focus list. This makes the editor's `onFocusChange()` method 
 * automatically bound to the focus list, and the editor can emit a `changefocus` event to change the currently focused
 * element by ID.
 */
.directive('b3FocusEditorLinker', function($window) {
  return {
    restrict: "E",
    require: "^^b3FocusList",
    transclude: true,
    scope: {},
    link: function(_, _, _, focusListCtrl) {
      // Tell the editor about it.
      focusListCtrl.bindFocusCallback(focusableId => $window.app.editor.onFocusChange(focusableId));

      $window.app.editor.on('changefocus', function(e) {
        // _target is expected to be the ID of the focusable to select.
        focusListCtrl.selectById(e._target);
      });
    }
  }
})

/**
 * An attribute-based directive for elements that, for one reason or another, do not blur when the user clicks on a 
 * region outside of the containing element.
 */
.directive("b3ManualBlur", function($timeout) {
  return {
    restrict: "A",
    transclude: true,
    link: function(_, element) {
      $timeout(function() {
        // Find the closest ancestor to the current element that is a `b3-focus-list` to get the corresponding controller.
        // Will error if no such element exists or does not have the controller corresponding to b3FocusList.
        var focusListCtrl = angular.element(element[0].closest("b3-focus-list")).controller("b3FocusList");
        // Get the closest ancestor to the current element that is a `b3Focusable`.
        var focusable = element[0].closest("b3-focusable");

        // On a change in focus...
        focusListCtrl.bindFocusCallback(function(focusableId) {
          // If the ID of the currently focused element does not match that of the parent focusable...
          if (focusableId !== focusable.id) {
            // Blur the current element.
            element[0].blur();
          }
        });
      }, 1000, false);
      
    },
    templateUrl: "app/common/focus/manualBlur.html"
  }
});