angular.module("app.collapsibleList", [])

/**
 * A directive for a collapsible list. This directive transcludes both in scope and in content, so the scope
 * can be accessed by the parents of the associated element, and the original content is kept. Note that the content is
 * embedded inside of a div, not a ul like one may expect. The directive includes two buttons to expand and collapse the
 * list respectively, and they are visible as appropriate (i.e., only the expand button is visible when the list is 
 * collapsed and only the collapse button is visible when the list is expanded).
 * 
 * The directve also has support to set the "header" element so that the content appears to the right of the button
 * instead of below it. This can be done by including an element using the b3CollapsibleListHeader directive as a child
 * of the element using the b3CollapsibleList directive.
 */
.directive("b3CollapsibleList", function() {
  return {
    restrict: "E",
    transclude: true,
    scope: {},
    templateUrl: "app/common/collapsibleList/collapsibleList.html",
    controller: ["$scope", "$element", "$timeout", "$window", function CollapsibleUlController($scope, $element, $timeout, $window) {
      var this_ = this;

      this.maxHeight = 0;

      /**
       * Adds a header `headerElement` to the list. This allows the expand / collapse button to display to the left of
       * the header. This method would be called by the `b3CollapsibleListHeader` directive if it is embedded in a 
       * `b3CollapsibleList`.
       *
       * @param {*} headerElement the header element to add
       */
      this.addHeader = function(headerElement) {
        var headerDisplay = angular.element($element[0].querySelector("#b3-collapsible-list-header-display"));
        headerDisplay.append(headerElement);
      }

      /**
       * Updates the `max-height` CSS property of the current list to be correct when it is fully expanded. If the list
       * is currently collapsed, it is automatically expanded. Also calls `updateMaxHeight()` on the nearest ancestor
       * that is a `b3-collapsible-list` if it exists and the change in max height is positive.
       * 
       * If `changedMaxHeight` is defined and a nonzero value, the list will cap its change in the `max-height` CSS 
       * property to this value.
       * 
       * @param {number?} changedMaxHeight (optional) the change in max height to use as a limiter for change.
       */
      this.updateMaxHeight = function(changedMaxHeight, source) {
        // FIXME: this code contains a race condition somewhere. There is a bug where if some items in the list are 
        // removed and the children force the parent to update the max height, the max height can be updated correctly 
        // but then be subtracted, which makes the current list overcorrect.
        // Unset max height so that the true height of the list can be retrieved.
        var items = $element[0].querySelector("#b3-collapsible-list-items");
        var itemsJQ = angular.element(items);
        itemsJQ.css("max-height", "none");

        var collapsed = !$scope.expanded;
  
        // If currently collapsed...
        if (collapsed) {
          // Expand. Not only does this allow the max height to be adjusted properly, but it also makes changes in the
          // length of the list visible.
          $scope.setExpandState(true);
        }

        // Wait for the DOM to update before setting the max height again.
        $timeout(function() {
          var oldMaxHeight = this_.maxHeight;

          // If the changedMaxHeight argument is defined and adding it results in a value bigger than 
          // items.offsetHeight...
          if (changedMaxHeight && this_.maxHeight + changedMaxHeight > items.offsetHeight)
            // Update by changedMaxHeight instead of defining the new max height.
            this_.maxHeight += changedMaxHeight;
          else
            this_.maxHeight = items.offsetHeight;

          // TODO: prevent the max height from going low enough that it will prevent inner collapsible lists from fully
          // rendering.
          // Set the max height.
          itemsJQ.css("max-height", this_.maxHeight + "px");

          // Get the controller of the parent b3CollapsibleList.
          var parentListCtrl = this_.getParentCtrl();

          // If it exists...
          if (parentListCtrl) {
            // Propagate the updateMaxheight call.
            parentListCtrl.updateMaxHeight(this_.maxHeight - oldMaxHeight);
          }
        }, 1, false);
      }

      /**
       * Returns the controller corresponding to the nearest ancestor of the current element that is a 
       * `b3CollapsibleList`.
       * @returns the controller corresponding to the nearest ancestor of the current element that is a 
       *   `b3CollapsibleList`
       */
      this.getParentCtrl = function() {
        // Because closest() searches through the element itself in addition to its ancestors, it is necessary to start
        // the search at the parent of the current element to avoid infinite recursion.
        var parentElement = $element[0].parentElement;

        // If such an element exists...
        if (parentElement) {
          // Find the b3-collapsible-list.
          var parentList = parentElement.closest("b3-collapsible-list");

          // If that element exists...
          if (parentList) {
            // Get its controller and return it.
            return angular.element(parentList).controller("b3CollapsibleList");
          }
        }

        // No controller found. Return null.
        return null;
      }

      $scope.expanded = true;  // Whether or not the list is expanded.

      /**
       * Sets whether or not the list is expanded.
       * 
       * @param {boolean} expanded whether or not the list is expanded
       */
      $scope.setExpandState = function(expanded) {
        $scope.expanded = expanded;
      }

      // Watch for a change in the number of children (as this means that the max-height must be readjusted)
      $scope.$watch(function() {
        var items = $element[0].querySelector("#b3-collapsible-list-items");
        return items.children[0].children.length;
      }, function() {
        this_.updateMaxHeight();
      });

      // Update max height of parents on creation, if they exist.
      $timeout(function() {
        var parentListCtrl = this_.getParentCtrl();

        // If the parent controller is defined...
        if (parentListCtrl)
          parentListCtrl.updateMaxHeight();
      }, 1, false);

      $window.app.editor.on("collapseall", function() {$scope.setExpandState(false);});
      $window.app.editor.on("expandall", function() {$scope.setExpandState(true);});
    }]
  }
})

/**
 * A directive that sets the header element of the b3CollapsibleUl directive to use the content in the body of the
 * directive's element. The content in the element using the b3CollapsibleListHeader directive is automatically removed.
 */
.directive("b3CollapsibleListHeader", function() {
  return {
    restrict: "E",
    require: "^^b3CollapsibleList",
    transclude: true,
    templateUrl: "app/common/collapsibleList/collapsibleListHeader.html",
    link: function(scope, element, _, collapsibleListCtrl) {
      // Add the header.
      collapsibleListCtrl.addHeader(element[0].firstChild);
      // No need to hide this element because the content is already removed.
    }
  }
})