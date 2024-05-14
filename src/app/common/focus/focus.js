angular.module('app.focus', [])

/**
 * A directive for an element capable of communicating with "focusable" elements (see corresponding documentation). A
 * focus-list has only one "focusable" element that can be focused at a time. The id (or index if unavailable) of the 
 * currently focused element is stored as the "focusedElement" field. All focusable elements except for the currently 
 * focused one will have "isFocused" set to false.
 */
.directive('focusList', function() {
  return {
    transclude: true,
    controller: ['$scope', function FocusListController($scope) {
      $scope.focusables = [];
      $scope.focusedElement = null;

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
      };

      this.addFocusable = function(focusable) {
        $scope.focusables.push(focusable);
        // if ($scope.focusables.length === 1) {
          this.select(focusable);
        // }
      };
    }],
    templateUrl: "app/common/focus/focusList.html"
  }
})

/**
 * A directive for an element that can be focused. Must be the child of an element with the focusList directive. Whether
 * or not the element is "focused" is determined by the namesake field. Clicking inside of this kind of element will 
 * cause it to become focused and all other elements to become unfocused.
 */
.directive('focusable', function($document) {
  return {
    require: "^^focusList",
    transclude: true,
    scope: {},
    link: function(scope, element, _, focusListCtrl) {
      focusListCtrl.addFocusable(scope);
      // TODO: Put a variable here to only fire these events when the focus level changes.
      $document.on("click", function(e) {
        // If the element that was clicked on is the current element or it is an element inside of the current 
        // element...
        if (element === e.target || element[0].contains(e.target)) {
          // $apply is needed to make sure that the element updates accordingly.
          scope.$apply(function() {
            // Select this as the focused element.
            focusListCtrl.select(scope);
          })
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
.directive('remoteFocusable', function($document) {
  return {
    require: "^^focusList",
    transclude: true,
    scope: {
      focusId: "@"
    },
    link: function(scope, _, _, focusListCtrl) {
      var element = document.getElementById(scope.focusId);
      focusListCtrl.addFocusable(scope);
      // TODO: Put a variable here to only fire these events when the focus level changes.
      $document.on("click", function(e) {
        // If the element that was clicked on is the current element or it is an element inside of the current 
        // element...
        if (element === e.target || element.contains(e.target)) {
          // $apply is needed to make sure that the element updates accordingly.
          scope.$apply(function() {
            // Select this as the focused element.
            focusListCtrl.select(scope);
          })
        }
      });
    },
    templateUrl: "app/common/focus/focusable.html"
  }
});