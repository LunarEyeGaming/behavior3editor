angular.module('app.tree')

.directive('b3TreeTabs', function() {
  return {
    restrict: 'E',
    controller: 'TreeController',
    templateUrl: 'app/tree/tree.html'
  }
});
