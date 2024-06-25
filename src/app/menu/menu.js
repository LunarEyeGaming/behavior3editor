angular.module('app.menu', ['app.modal'])

.controller('MenuController', function($scope, $rootScope, $timeout, $window, ModalService) {
  this.update = function() {
    var settings = $window.app.editor.settings;

    // UPDATE LABELS ON THE MENU
    $timeout(function() {
      $scope.$apply(function() {
        for (var k in settings._dict) {
          if (k.indexOf('key_') == 0) {
            var value = settings.get(k);
            $scope[k] = value;
          }
        }
      });
    }, 0, false);

    // UPDATE CALLBACKS
    $window.keyboard(settings.get('key_undo'), function(e) {$scope.onButtonUndo(e)});
    $window.keyboard(settings.get('key_redo'), function(e) {$scope.onButtonRedo(e)});
    $window.keyboard(settings.get('key_copy'), function(e) {$scope.onButtonCopy(e)});
    $window.keyboard(settings.get('key_cut'), function(e) {$scope.onButtonCut(e)});
    $window.keyboard(settings.get('key_paste'), function(e) {$scope.onButtonPaste(e)});
    $window.keyboard(settings.get('key_duplicate'), function(e) {$scope.onButtonDuplicate(e)});
    $window.keyboard(settings.get('key_remove'), function(e) {$scope.onButtonRemove(e)});
    $window.keyboard(settings.get('key_organize'), function(e) {$scope.onButtonAutoOrganize(e)});
    $window.keyboard(settings.get('key_zoom_in'), function(e) {$scope.onButtonZoomIn(e)});
    $window.keyboard(settings.get('key_zoom_out'), function(e) {$scope.onButtonZoomOut(e)});
    $window.keyboard(settings.get('key_select_all'), function(e) {$scope.onButtonSelectAll(e)});
    $window.keyboard(settings.get('key_deselect_all'), function(e) {$scope.onButtonDeselectAll(e)});
    $window.keyboard(settings.get('key_invert_selection'), function(e) {$scope.onButtonInvertSelection(e)});
    $window.keyboard(settings.get('key_new_project'), function(e) {$scope.onButtonNewProject(e)});
    $window.keyboard(settings.get('key_open_project'), function(e) {$scope.onButtonOpenProject(e)});
    $window.keyboard(settings.get('key_new_tree'), function(e) {$scope.onButtonNewTree(e)});
    $window.keyboard(settings.get('key_new_node'), function(e) {$scope.onButtonNewNode(e)});
    $window.keyboard(settings.get('key_open_tree'), function(e) {$scope.onButtonOpenTree(e)});
    $window.keyboard(settings.get('key_save_tree'), function(e) {$scope.onButtonSaveTree(e)});
    $window.keyboard(settings.get('key_save_as'), function(e) {$scope.onButtonSaveAs(e)});
  }
  this.update();
  $window.app.editor.on('shortcutsChanged', this.update, this);

  // CALLBACKS ----------------------------------------------------------------
  // this.onButtonNewProject = function(e) {}
  // ...
  $scope.onButtonNewTree = function(e) {
    if (e) e.preventDefault();
    $rootScope.$broadcast('onButtonNewTree');
    return false;
  }
  $scope.onButtonOpenTree = function(e) {
    if (e) e.preventDefault();

    dialog.showOpenDialog(remote.getCurrentWindow(), {
      title: "Open Behavior File",
      filters : [
        { name: "Behavior", extensions: ['behavior']},
        { name: "All files", extensions: ['*']}
      ]
    }, function(filenames) {
      if (filenames) {
        var filename = filenames[0];
        $window.app.editor.openTreeFile(filenames[0]);
      }
    });

    return false;
  }
  $scope.onButtonSaveTree = function(e) {
    if (e) e.preventDefault();

    $window.app.editor.saveTree(true);
    return false;
  }
  $scope.onButtonSaveAs = function(e) {
    if (e) e.preventDefault();

    $window.app.editor.saveTree(false);
    return false;
  }
  $scope.onButtonImportNodes = function(e) {
    if (e) e.preventDefault();

    var editor = $window.app.editor;
    dialog.showOpenDialog(remote.getCurrentWindow(), {
      title: "Import nodes",
      filters : [
        { name: "Nodes", extensions: ['nodes']},
        { name: "All files", extensions: ['*']}
      ],
      properties: ["multiSelections"]
    }, function(filenames) {
      if (filenames) {
        // Go through each file and try to read it, importing the nodes into the editor when successful.
        // TODO: Make a better system for handling errors.
        filenames.forEach(filename => {
          fs.readFile(filename, function(err, data) {
            if (err) throw err;

            $window.app.editor.importNodes(data, path.dirname(filename), true);
  
            editor.notifySuccess("Imported nodes from file '{0}'", path.basename(filename));
          });
        });
      }
    });
    return false;
  }
  $scope.onButtonExportNodes = function(e) {
    if (e) e.preventDefault();
    $rootScope.$broadcast('onButtonExportNodes');
    return false;
  }

  $scope.onButtonNewProject = function(e) {
    if (e) e.preventDefault();

    ModalService.showModal({
      templateUrl: "app/project/modal-newproject.html",
      controller: 'NewProjectModalController',
    }).then(function(modal) {
      modal.close.then(function(result) {});
    });

    return false;
  }

  $scope.onButtonOpenProject = function(e) {
    if (e) e.preventDefault();

    var editor = $window.app.editor;
    dialog.showOpenDialog(remote.getCurrentWindow(), {
      title: "Open project",
      filters : [
        { name: "Behavior project", extensions: ['behavior-project']},
        { name: "All files", extensions: ['*']}
      ]
    }, function(filenames) {
      if (filenames) {
        var filename = filenames[0];
        fs.readFile(filename, function(err, data){
          if (err) throw err;
          var project = b3editor.Project.load(filename, data);
          editor.loadProject(project);
        });
      }
    });
    return false;
  }

  $scope.onButtonNewNode = function(e) {
    if (e) e.preventDefault();
    $rootScope.$broadcast('onButtonNewNode');
    return false;
  }
  $scope.onButtonCopy = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.copy();
  }
  $scope.onButtonCut = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.cut();
  }
  $scope.onButtonPaste = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.paste();
  }
  $scope.onButtonDuplicate = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.duplicate();
  }
  $scope.onButtonRemove = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.remove();
  }
  $scope.onButtonUndo = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.undo();
  }
  $scope.onButtonRedo = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.redo();
  }
  $scope.onButtonRemoveAllConnections = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.removeConnections();
  }
  $scope.onButtonRemoveInConnections = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.removeInConnections();
  }
  $scope.onButtonRemoveOutConnections = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.removeOutConnections();
  }
  $scope.onButtonAutoOrganize = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.pushCommandTree('Organize', {});
  }
  $scope.onButtonZoomIn = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.zoomIn();
    $window.app.game.stage.update();
  }
  $scope.onButtonZoomOut = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.zoomOut();
    $window.app.game.stage.update();
  }
  $scope.onButtonCollapseAll = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.collapseAll();
  }
  $scope.onButtonExpandAll = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.expandAll();
  }
  $scope.onButtonShowNotifications = function(e) {
    if (e) e.preventDefault();
    $rootScope.$broadcast('onButtonShowNotifications');
  }
  $scope.onButtonSelectAll = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.selectAll();
  }
  $scope.onButtonDeselectAll = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.deselectAll();
  }
  $scope.onButtonInvertSelection = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.invertSelection();
  }
  // --------------------------------------------------------------------------

})

.directive('menu', function() {
  return {
    restrict: 'E',
    controller: 'MenuController',
    templateUrl: 'app/menu/menu.html'
  }
});
