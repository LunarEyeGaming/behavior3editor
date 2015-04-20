angular.module('app.export', ['app.modal'])

.controller('ExportModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };
  $scope.json = $window.app.editor.exportToJSON();
  
  var this_ = this;
});
