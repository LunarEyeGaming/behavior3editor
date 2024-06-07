angular.module('app.tree')

.directive('b3TreeTabs', function() {
  return {
    restrict: 'E',
    controller: 'TreeController',
    templateUrl: 'app/tree/tree.html'
  }
})

.directive('b3DraggableTreeTab', function($window) {
  return {
    restrict: 'A',
    link: function(scope, element, attributes, controller) {
      angular.element(element).attr("draggable", "true");
      element.bind("dragstart", function(e) {
        e.dataTransfer.setData('text', attributes.id);
      });
    }
  }
});
