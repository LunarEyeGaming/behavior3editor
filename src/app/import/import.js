angular.module('app.import', ['app.modal'])

.controller('ImportModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };
  
  var this_ = this;
  $scope.types = ['composite', 'decorator', 'action'];

  $scope.importTree = function() {
    var json = document.querySelector('#import-json').value;
    // console.log(json);
    // alert("Test");
    $window.app.editor.importFromJSON(json);
  }
});
