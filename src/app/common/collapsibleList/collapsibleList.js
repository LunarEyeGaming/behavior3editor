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
    controller: ["$scope", "$element", "$timeout", function CollapsibleUlController($scope, $element, $timeout) {
      $scope.expanded = true;  // Whether or not the list is expanded.

      $scope.setExpandState = function(expanded) {
        $scope.expanded = expanded;
      }

      this.setHeader = function(headerElement) {
        var headerDisplay = angular.element($element[0].querySelector("#b3-collapsible-list-header-display"));
        headerDisplay.append(headerElement);
      }

      $timeout(function() {
        var items = $element[0].querySelector("#b3-collapsible-list-items");
        var itemsJQ = angular.element(items);
        itemsJQ.css("max-height", items.offsetHeight + "px");
      }, 1, false);
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
      // Set the header.
      collapsibleListCtrl.setHeader(element[0].firstChild);
      // No need to hide this element because the content is already removed.
    }
  }
})