angular.module("app.filename", ["app.modal"])

.controller("FilenameController", function($scope, $rootScope, $window, $timeout, ModalService) {
  $scope.treeName = $window.app.editor.tree.blocks[0].title;
  $scope.path = $window.app.editor.tree.path;
  $scope.isSaved = true;

  this.currentTreeId = $window.app.editor.tree.id;

  /**
   * Updates multiple scope fields through an object. Due to the nature of this method, using it can pose security 
   * risks.
   * 
   * @param {object} fieldChanges an object where each key is the field to change and each value is the value to set for
   *   the corresponding key
   */
  this.updateScopeFields = function(fieldChanges) {
    $timeout(function() {
      $scope.$apply(function() {
        for (var key in fieldChanges)
          $scope[key] = fieldChanges[key];
      });
    }, 0, false);
  }

  /**
   * Handles what happens when a tree is selected
   * 
   * @param {object} e an object whose `_target` is the tree selected
   */
  this.onTreeSelected = function(e) {
    this.currentTreeId = e._target.id;

    this.updateScopeFields({
      treeName: e._target.blocks[0].title,
      path: e._target.path,
      isSaved: e._target.undoHistory.isSaved()
    });
  }

  /**
   * Handles what happens when a tree is saved
   * 
   * @param {object} e an object whose `_target` is the tree saved
   */
  this.onTreeSaved = function(e) {
    // If the tree saved has an ID that matches the currently displayed tree...
    if (e._target.id == this.currentTreeId)
      // Update fields.
      this.updateScopeFields({
        treeName: e._target.blocks[0].title,
        path: e._target.path,
        isSaved: true
      });
  }

  /**
   * Handles what happens when a block is changed.
   * 
   * @param {object} e an object whose `_target` is the block that is changed and has other fields containing the
   *   changes that were made.
   */
  this.onBlockChanged = function(e) {
    // If the affected block is the root and the title has changed...
    if (e._target.type === 'root' && e.oldValues.title !== e.newValues.title) {
      // Update the tree name.
      this.updateScopeFields({treeName: e.newValues.title});
    }
  }

  /**
   * Handles what happens when the save status of a tree changes.
   * 
   * @param {object} e an object containing the `_target` tree whose save status was changed.
   */
  this.onSaveStatusChange = function(e) {
    // If the tree saved has an ID that matches the currently displayed tree...
    if (e._target.id == this.currentTreeId) {
      // Update save status.
      this.updateScopeFields({isSaved: e._target.undoHistory.isSaved()});
    }
  }

  $window.app.editor.on("treesaved", this.onTreeSaved, this);
  $window.app.editor.on("treeselected", this.onTreeSelected, this);
  $window.app.editor.on("treesavestatuschanged", this.onSaveStatusChange, this);
  $window.app.editor.on('blockchanged', this.onBlockChanged, this);
})

.directive("filename", function() {
  return {
    restrict: 'E',
    controller: 'FilenameController',
    templateUrl: 'app/filename/filename.html'
  }
})