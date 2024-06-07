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

  /**
   * Sets the data transfer contents to contain the ID of the tree tab being dragged.
   * 
   * @param {DataTransfer} dataTransfer the data transfer object to modify
   * @param {string} id the ID of the tree being dragged.
   */
  $scope.setDragData = function(dataTransfer, id) {
    // Clear cache.
    dataTransfer.clearData();

    dataTransfer.setData("text", id);
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

  /**
   * Moves the scroll position to make the tab corresponding to `id` fully visible if it is not fully visible already.
   * 
   * @param {string} id the ID of the tree corresponding to the tab to show
   */
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

  /**
   * Takes in an iterable of tab elements `treeTabs` and returns an array of numbers with the following properties:
   * * the last element is `Infinity`
   * * the elements prior are the horizontal midpoints of the boundary boxes of the elements of `treeTabs` relative to
   *   the viewport
   * 
   * @precondition `treeTabs` has a method `forEach` and the order of iteration ensures that the return value is sorted
   * in ascending order
   * 
   * @param {*} treeTabs the list of tab elements to use
   * @returns an array of boundaries to use for locating a tab insertion point
   */
  this.getTabMidBoundsList = function(treeTabs) {
    var treeTabBoundsList = [];

    // For each tree tab...
    treeTabs.forEach(treeTab => {
      // Get horizontal midpoint boundary.
      var treeTabBounds = treeTab.getBoundingClientRect();
      var treeTabMid = (treeTabBounds.left + treeTabBounds.right) / 2;

      // Add boundary to list.
      treeTabBoundsList.push(treeTabMid);
    });

    // Add positive infinity boundary.
    treeTabBoundsList.push(Infinity);

    return treeTabBoundsList;
  }

  /**
   * Searches for and returns the index of the first number in a list of boundaries `boundsList` that is greater than
   * the horizontal viewpoint position of the cursor `cursorXPos`.
   * 
   * @param {number[]} midBoundsList an array of boundaries against which to check `cursorXPos`
   * @param {number} cursorXPos the horizontal viewpoint position of the cursor
   * @returns the index of the first number in `midBoundsList` that is greater than `cursorXPos`
   */
  this.getIndexedCursorLocation = function(midBoundsList, cursorXPos) {
    // For each midpoint boundary (enumerated)...
    for (var i = 0; i < midBoundsList.length; i++) {
      // If the horizontal cursor position is less than the boundary...
      if (cursorXPos < midBoundsList[i])
        // Stop and return the index-wise location of the cursor.
        return i;
    }
  }

  var temp = document.createElement("div");
  temp.className = "tab-insert-slot";
  var tabPreviewElement = angular.element(temp);

  // Fired periodically while the cursor is dragging something and is hovering over the current element.
  $element.bind("dragover", function(e) {
    // TODO: Maybe optimize this bit of code? It seems like a horrible idea to query a whole bunch of elements close to
    // a hundred times per second.
    var data = e.dataTransfer.getData("text");

    // If the transferred data represents a tab being moved...
    if (data && data.startsWith("tree-")) {
      // If e.preventDefault is defined...
      if (e.preventDefault)
        e.preventDefault();  // Allow the user to drag.

      var treeTabs = $element[0].querySelectorAll("div.tab");

      // Build list of jqLite-wrapped elements.
      var treeTabsJq = [];
      treeTabs.forEach(tab => treeTabsJq.push(angular.element(tab)));

      // Get the index of the element on which to call `after()`. Because all midpoint boundaries except for the last 
      // one correspond directly to the element before which we should insert the tab preview, we need to subtract by 1
      // to get this value. Note that this does make insertionPoint represent an invalid index for the first element.
      var insertionPoint = this_.getIndexedCursorLocation(this_.getTabMidBoundsList(treeTabs), e.clientX) - 1;

      // If the insertion point is valid (i.e., nonnegative)...
      if (insertionPoint >= 0) {
        // Insert tab preview after the element corresponding to insertionPoint.
        treeTabsJq[insertionPoint].after(tabPreviewElement);
      }  // Otherwise, if insertionPoint is -1...
      else if (insertionPoint === -1) {
        // Prepend tab preview to parent list.
        treeTabsJq[0].parent().prepend(tabPreviewElement);
      }  // Otherwise...
      else {
        // Throw an error. This is intended to prevent bugs that are difficult to detect.
        throw new Error("Invalid value for insertionPoint: " + insertionPoint);
      }
    }
  })

  // Fired when the user drops whatever they have.
  $element.bind("drop", function(e) {
    var data = e.dataTransfer.getData("text");

    // If the transferred data represents a tab being moved...
    if (data && data.startsWith("tree-")) {
      // If e.preventDefault is defined...
      if (e.preventDefault)
        e.preventDefault();  // Allow the user to drop.

      // Remove tab preview from the list. This is redundant in all cases except for moving the tab to the beginning.
      tabPreviewElement.remove();

      var treeTabs = $element[0].querySelectorAll("div.tab");

      // Get the index of the place to insert the tab. `getIndexedCursorLocation` corresponds directly to the element 
      // before which we insert the tab.
      var insertionPoint = this_.getIndexedCursorLocation(this_.getTabMidBoundsList(treeTabs), e.clientX);

      // Get the editor to move the tree.
      $window.app.editor.moveTree(data.replace("tree-", ""), insertionPoint);
    }
  })

  // Fired when the user leaves the drag zone. Not cancelable and will bubble up.
  $element.bind("dragleave", function(e) {
    tabPreviewElement.remove();  // Remove preview element.
  })

  this.updateTrees();

  $window.app.editor.on('blockchanged', this.onBlockChanged, this);
  $window.app.editor.on('treeadded', this.updateTrees, this);
  $window.app.editor.on('treeremoved', this.updateTrees, this);
  $window.app.editor.on('treeselected', this.onTreeSelected, this);
  $window.app.editor.on('treemoved', this.updateTrees, this);
  $window.app.editor.on('treesavestatuschanged', this.onTreeSaveStatusChanged, this);
  $window.app.editor.on('treesaved', this.onTreeSaveStatusChanged, this);
  $rootScope.$on('onButtonNewTree', $scope.addTree);
})
