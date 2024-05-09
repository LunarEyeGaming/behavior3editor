angular.module("app.filename", ["app.modal"])

.controller("FilenameController", function($scope, $rootScope, $window, $timeout, ModalService) {
  $scope.filename = $window.app.editor.tree.blocks[0].title;
  $scope.path = $window.app.editor.tree.path;

  this.onTreeSelected = function(e) {
    $timeout(function() {
      $scope.$apply(function() {
        $scope.filename = e._target.blocks[0].title;
        $scope.path = e._target.path;
      });
    }, 0, false);
  }

  // Right now, this function is just an alias, but it can be changed not to be one in the future.
  this.onTreeSaved = this.onTreeSelected

  $window.app.editor.on("treeselected", this.onTreeSelected, this);
  $window.app.editor.on("treesaved", this.onTreeSaved, this);
})

.directive("filename", function() {
  return {
    restrict: 'E',
    controller: 'FilenameController',
    templateUrl: 'app/filename/filename.html'
  }
})