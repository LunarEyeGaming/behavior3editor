angular.module('app.tree', ['app.modal'])


//
// TREE CONTROLLER
//
.controller('TreeController', function($scope, $rootScope, $window, $timeout, $element, ModalService) {
  var this_ = this;

  $scope.currentTree = $window.app.editor.tree.id;

  $scope.canRemoveTree = function() {
    return $window.app.editor.trees.length > 1;
  }

  $scope.removeTree = function(treeId) {
    $window.app.editor.removeTree(treeId);
  }

  $scope.addTree = function() {
    $window.app.editor.addTree();
  }
  $scope.selectTree = function(id) {
    if (id !== $scope.currentTree) {
      $window.app.editor.selectTree(id);
    }
  }

  this.updateTrees = function(e, id) {
    var trees = $window.app.editor.trees;

    // update all trees
    if (!id) {
      var data = [];

      for (var i=0; i<trees.length; i++) {
        var tree = trees[i];
        var id = tree.id;
        var name = tree.blocks[0].title;
        var isSaved = tree.undoHistory.isSaved();
        data.push({id:id, name:name, isSaved:isSaved});
      }

      // timeout needed due to apply function
      // apply is used to update the view automatically when the scope is changed
      $timeout(function() {
        $scope.$apply(function() {
          $scope.trees = data;
        });
      }, 0, false);
    }

    // only update a specific tree
    else {
      for (var i=0; i<trees.length; i++) {
        var tree = trees[i];
        if (tree.id === id) {
          $timeout(function() {
            $scope.$apply(function() {
              $scope.trees[i].name = tree.blocks[0].getTitle();
              $scope.trees[i].isSaved = tree.undoHistory.isSaved();
            });
          }, 0, false);
          return
        }
      }
    }
  }
  this.onTreeSelected = function(e) {
    $timeout(function() {
      this_.showTreeTab(e._target.id);

      $scope.$apply(function() {
        $scope.currentTree = e._target.id;
      });
    }, 0, false);
  }
  this.onBlockChanged = function(e) {
    if (e._target.type === 'root' && e.oldValues.title !== e.newValues.title) {
      this.updateTrees(e, e._target.id);
    }
  }
  this.onTreeSaveStatusChanged = function(e) {
    this.updateTrees(e, e._target.id);
  }
  this.showTreeTab = function(id) {
    // Find the element containing the tree tabs and the element containing the tab that was selected.
    var treeTabs = $element[0].querySelector("#tree-tabs");
    var treeTab = $element[0].querySelector("#tree-" + id);

    // Get bound boxes for the two elements.
    var treeTabsBounds = treeTabs.getBoundingClientRect();
    var treeTabBounds = treeTab.getBoundingClientRect();

    // Calculate the number of pixels horizontally that the currently selected tree tab is outside of the tab list box
    // in either direction (positive values indicate too far to the left or to the right respectively).
    var leftDeviation = treeTabsBounds.left - treeTabBounds.left;
    var rightDeviation = treeTabBounds.right - treeTabsBounds.right;

    // If the tab is too far to the left...
    if (leftDeviation > 0)
      // Shift the scrolling position to the left by that deviation (this moves the tabs to the right relative to the 
      // viewport).
      treeTabs.scrollLeft -= leftDeviation;
    // Otherwise, if the tab is too far to the right...
    else if (rightDeviation > 0)
      // Shift the scrolling position to the right by that deviation (this moves the tabs to the left relative to the
      // viewport)
      treeTabs.scrollLeft += rightDeviation;
  }

  this.updateTrees();

  $window.app.editor.on('blockchanged', this.onBlockChanged, this);
  $window.app.editor.on('treeadded', this.updateTrees, this);
  $window.app.editor.on('treeremoved', this.updateTrees, this);
  $window.app.editor.on('treeselected', this.onTreeSelected, this);
  $window.app.editor.on('treesavestatuschanged', this.onTreeSaveStatusChanged, this);
  $window.app.editor.on('treesaved', this.onTreeSaveStatusChanged, this);
  $rootScope.$on('onButtonNewTree', $scope.addTree);
})
