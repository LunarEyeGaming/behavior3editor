var app = angular.module('app', [
  'app.tabs',
  'app.sidebar',
  'app.modal',
  'app.notification',
  'app.scrollable',
  'app.menu',
  'app.node',
  'app.tree',
  'app.property',
]);angular.module('app.sidebar', [])

.directive('sidebar', function() {
  return {
    restrict: 'E',
    scope: {
      class:'@class',
    },
    transclude: true,
    templateUrl: 'app/common/sidebar/sidebar.html'
  }
});angular.module('app.tabs', [])

.controller('TabController', function($scope) {
  $scope.index = 1;
  
  $scope.select = function(id) {
    $scope.index = id;
  }
  $scope.visible = function(id) {
    return $scope.index == id;
  }
});
angular.module('app.modal', [])

.controller('ModalController', function($scope, close) {
  $scope.close = function(result) {
    close(result); // close, but give 500ms for bootstrap to animate
  };
})

.factory('ModalService', ['$document', '$compile', '$controller', '$http', '$rootScope', '$q', '$timeout', '$templateCache',
  function($document, $compile, $controller, $http, $rootScope, $q, $timeout, $templateCache) {

  //  Get the body of the document, we'll add the modal to this.
  var body = $document.find('body');

  function ModalService() {

    var self = this;

    //  Returns a promise which gets the template, either
    //  from the template parameter or via a request to the
    //  template url parameter.
    var getTemplate = function(template, templateUrl) {
      var deferred = $q.defer();
      if(template) {
        deferred.resolve(template);
      } else if(templateUrl) {
        // check to see if the template has already been loaded
        var cachedTemplate = $templateCache.get(templateUrl);
        if(cachedTemplate !== undefined) {
          deferred.resolve(cachedTemplate);
        }
        // if not, let's grab the template for the first time
        else {
          $http({method: 'GET', url: templateUrl, cache: true})
            .then(function(result) {
              // save template into the cache and return the template
              $templateCache.put(templateUrl, result.data);
              deferred.resolve(result.data);
            })
            .catch(function(error) {
              deferred.reject(error);
            });
        }
      } else {
        deferred.reject("No template or templateUrl has been specified.");
      }
      return deferred.promise;
    };

    self.showModal = function(options) {

      //  Create a deferred we'll resolve when the modal is ready.
      var deferred = $q.defer();

      //  Validate the input parameters.
      var controllerName = options.controller;
      if(!controllerName) {
        deferred.reject("No controller has been specified.");
        return deferred.promise;
      }

      //  If a 'controllerAs' option has been provided, we change the controller
      //  name to use 'as' syntax. $controller will automatically handle this.
      if(options.controllerAs) {
        controllerName = controllerName + " as " + options.controllerAs;
      }

      //  Get the actual html of the template.
      getTemplate(options.template, options.templateUrl)
        .then(function(template) {

          //  Create a new scope for the modal.
          var modalScope = $rootScope.$new();

          //  Create the inputs object to the controller - this will include
          //  the scope, as well as all inputs provided.
          //  We will also create a deferred that is resolved with a provided
          //  close function. The controller can then call 'close(result)'.
          //  The controller can also provide a delay for closing - this is
          //  helpful if there are closing animations which must finish first.
          var closeDeferred = $q.defer();
          var inputs = {
            $scope: modalScope,
            close: function(result, delay) {
              if(delay === undefined || delay === null) delay = 0;
              $timeout(function () {
                closeDeferred.resolve(result);
              }, delay);
            }
          };

          //  If we have provided any inputs, pass them to the controller.
          if(options.inputs) {
            for(var inputName in options.inputs) {
              inputs[inputName] = options.inputs[inputName];
            }
          }

          //  Parse the modal HTML into a DOM element (in template form).
          var modalElementTemplate = angular.element(template);

          //  Compile then link the template element, building the actual element.
          //  Set the $element on the inputs so that it can be injected if required.
          var linkFn = $compile(modalElementTemplate);
          var modalElement = linkFn(modalScope);
          inputs.$element = modalElement;

          //  Create the controller, explicitly specifying the scope to use.
          var modalController = $controller(controllerName, inputs);


          //  Finally, append the modal to the dom.
          if (options.appendElement) {
            // append to custom append element
            options.appendElement.append(modalElement);
          } else {
            // append to body when no custom append element is specified
            body.append(modalElement);
          }

          //  We now have a modal object.
          var modal = {
            controller: modalController,
            scope: modalScope,
            element: modalElement,
            close: closeDeferred.promise
          };

          //  When close is resolved, we'll clean up the scope and element.
          modal.close.then(function(result) {
            //  Clean up the scope
            modalScope.$destroy();
            //  Remove the element from the dom.
            modalElement.remove();
          });

          deferred.resolve(modal);

        })
        .catch(function(error) {
          deferred.reject(error);
        });

      return deferred.promise;
    };

  }

  return new ModalService();
}]);
angular.module('app.notification', [])

.controller('NotificationController', function($scope, $window, $compile, $document) {
  var this_ = this;
  this.template = '\
  <div class="notification {0}">\
    {1}\
  </div>\
  ';
  this.createNotification = function(level, message) {
    var element = $compile(
      this.template.format(level, message)
    )($scope);
    var body = $document.find('body');
    var this_ = this;

    // remove on click
    element.bind('click', function() {
      element.css('opacity', 0);
      setTimeout(function() {
        element.remove();
      }, 500);
    });

    // remove in time
    setTimeout(function() {
      element.css('opacity', 0);
      setTimeout(function() {
        element.remove();
      }, 500);
    }, 3000);

    // appear
    setTimeout(function() {
      element.css('opacity', 1);
    }, 1);

    body.append(element);
  }

  this.onNotification = function(e) {
    this_.createNotification(e.level, e.message);
  }
  $window.app.editor.on('notification', this.onNotification, this);

});
angular.module('app.scrollable', [])

.directive('scrollable', function($window) {
  return {
    restrict: 'A',
    link: function(scope, element, attributes, controller) {
      var resize = function() {
        var e = element.parent().parent().parent().parent();
        element[0].style.height = e[0].offsetHeight-175 + 'px';
      }
      $window.addEventListener('resize', resize, true);
      resize();
    }
  }
});
angular.module('app.menu', [])

.controller('MenuController', function($scope, $rootScope, $timeout, $window) {
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
    $window.keyboard(settings.get('key_new_tree'), function(e) {$scope.onButtonNewTree(e)});
    $window.keyboard(settings.get('key_new_node'), function(e) {$scope.onButtonNewNode(e)});
    $window.keyboard(settings.get('key_import_tree'), function(e) {$scope.onButtonCopy(e)});
    $window.keyboard(settings.get('key_export_tree'), function(e) {$scope.onButtonCopy(e)});
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
    $window.app.editor.organize();
  }
  $scope.onButtonZoomIn = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.zoomIn();
  }
  $scope.onButtonZoomOut = function(e) {
    if (e) e.preventDefault();
    $window.app.editor.zoomOut();
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
});angular.module('app.node', ['app.modal'])

//
// NODE CONTROLLER
//
.controller('NodeController', function($scope, $rootScope, $window, $timeout, ModalService) {
  var this_ = this;

  // SCOPE --------------------------------------------------------------------
  $scope.categories = ['composite', 'decorator', 'condition', 'action'];
  $scope.nodes = {};
  
  $scope.showAddNodeModal = function() {
    ModalService.showModal({
      templateUrl: "app/node/modal-addnode.html",
      controller: 'AddNodeModalController'
    }).then(function(modal) {
      modal.close.then(function(result) {
      });
    });
  };

  $scope.showEditNodeModal = function(node) {
    ModalService.showModal({
      templateUrl: "app/node/modal-editnode.html",
      controller: 'EditNodeModalController',
      inputs: {'node': node}
    }).then(function(modal) {
      modal.close.then(function(result) {});
    });
  };

  $scope.canEditNode = function(name) {
    return !$window.b3[name];
  }

  $scope.getTitle = function(node) {
    var title = node.prototype.title || node.prototype.name;
    title = title.replace(/(<\w+>)/g, function(match, key) { return '@'; });
    return title;
  }
  // --------------------------------------------------------------------------

  // UPDATE NODES--------------------------------------------------------------
  this.updateNodes = function() {
    var guiNodes = {
      'composite' : [],
      'decorator' : [],
      'condition' : [],
      'action'    : []
    };
    var editorNodes = $window.app.editor.nodes;

    for (key in guiNodes) {
      for (nodeName in editorNodes) {
        var node = editorNodes[nodeName];
        if (node.prototype.category === key) {
          guiNodes[key].push(node);
        }
      }
    }
    
    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.nodes = guiNodes;
      });
    }, 0, false);
  }
  // --------------------------------------------------------------------------

  // REGISTER EVENTS ----------------------------------------------------------
  $window.app.editor.on('nodeadded', this.updateNodes, this);
  $window.app.editor.on('noderemoved', this.updateNodes, this);
  $window.app.editor.on('nodechanged', this.updateNodes, this);
  $rootScope.$on('onButtonNewNode', $scope.showAddNodeModal);
  // --------------------------------------------------------------------------

  // INITIALIZE ELEMENTS ------------------------------------------------------
  this.updateNodes();
  // --------------------------------------------------------------------------
})


//
// ADD NODE MODAL CONTROLLER
//
.controller('AddNodeModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };
  
  // DYNAMIC TABLE ------------------------------------------------------------
  this.template = '\
    <tr>\
      <td><input id="name" type="text" placeholder="name" /></td>\
      <td><input id="title" type="text" placeholder="title" /></td>\
      <td>\
        <select id="category">\
          <option value="composite">Composite</option>\
          <option value="decorator">Decorator</option>\
          <option value="condition">Condition</option>\
          <option value="action" selected>Action</option>\
        </select>\
      </td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  var this_ = this;
  $scope.addRow = function() {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    
    var table = document.querySelector('#addnode-properties-table>tbody');
    var template = $compile(this_.template)($scope);
    angular.element(table).append(template);
  }

  $scope.addNodes = function() {
    var domNames = document.querySelectorAll('#addnode-properties-table #name');
    var domTitles = document.querySelectorAll('#addnode-properties-table #title');
    var domCategories = document.querySelectorAll('#addnode-properties-table #category');
    
    for (var i=0; i<domNames.length; i++) {
      var name = domNames[i].value;
      var title = domTitles[i].value;
      var category = domCategories[i].value;

      if (name) {
        $window.app.editor.addNode(name, title, category)
      }
    }
  }
})


//
// EDIT NODE MODAL CONTROLLER
//
.controller('EditNodeModalController', function($scope, $window, $compile, close, node) {
  $scope.close = function(result) { close(result); };

  $scope.node = $window.app.editor.nodes[node];

  $scope.saveNode = function() {
    var domName = document.querySelector('#editnode-form #name');
    var domTitle = document.querySelector('#editnode-form #title');
    
    var name = domName.value;
    var title = domTitle.value;

    if (name) {
      $window.app.editor.editNode(node, name, title);
    }
  }

  $scope.removeNode = function() {
    $window.app.editor.removeNode(node);
  }
});angular.module('app.node')

.directive('nodepanel', function() {
  return {
    restrict: 'E',
    controller: 'NodeController',
    templateUrl: 'app/node/node.html',
  }
})

.directive('draggableNode', function($window) {
  return {
    restrict: 'A',
    link: function(scope, element, attributes, controller) {
      angular.element(element).attr("draggable", "true");
      element.bind("dragstart", function(e) {
        var img = $window.app.editor.preview(attributes.id.replace('node-', ''));
  
        e.dataTransfer.setData('text', attributes.id);
        e.dataTransfer.setDragImage(img, img.width/2, img.height/2);
      });
    }
  }
})

.directive('droppableNode', function($window) {
  return {
    restrict: 'A',
    link: function(scope, element, attributes, controller) {
      element.bind("dragover", function(e) {
        if (e.preventDefault) {
          e.preventDefault(); // Necessary. Allows us to drop.
        }
        return false;
      });
      element.bind("drop", function(e) {
        if (e.preventDefault) {
          e.preventDefault(); // Necessary. Allows us to drop.
        }
        if (e.stopPropagation) {
          e.stopPropagation(); // Necessary. Allows us to drop.
        }
        var data = e.dataTransfer.getData("text");

        // TODO: encapsulate this inside the editor
        var point = $window.app.editor.canvas.getLocalMousePosition(e.clientX, e.clientY);
        $window.app.editor.addBlock(data.replace('node-', ''), point.x, point.y);
      })
    }
  }
});angular.module('app.tree', ['app.modal'])


//
// TREE CONTROLLER
//
.controller('TreeController', function($scope, $rootScope, $window, $timeout, ModalService) {
  var this_ = this;

  // SHOW ADD NODE MODAL ------------------------------------------------------
  $scope.showEditTreeModal = function(treeId) {
    ModalService.showModal({
      templateUrl: "app/tree/modal-edittree.html",
      controller: 'EditTreeModalController',
      inputs: {'treeId': treeId}
    }).then(function(modal) {
      modal.close.then(function(result) {
      });
    });
  };
  // --------------------------------------------------------------------------
  
  $scope.currentTree = $window.app.editor.tree.id;

  $scope.canEditTree = function() {
    return $window.app.editor.trees.length > 1;
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
        data.push({id:id, name:name});
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
            });
          }, 0, false);
          return
        }
      }
    }
  }
  this.onTreeSelected = function(e) {
    $timeout(function() {
      $scope.$apply(function() {
        $scope.currentTree = e._target.id;
      });
    }, 0, false);
  }
  this.onBlockChanged = function(e) {
    if (e._target.category === 'root' && e.oldValues.title !== e.newValues.title) {
      this.updateTrees(e, e._target.id);
    }
  }

  this.updateTrees();

  $window.app.editor.on('blockchanged', this.onBlockChanged, this);
  $window.app.editor.on('treeadded', this.updateTrees, this);
  $window.app.editor.on('treeremoved', this.updateTrees, this);
  $window.app.editor.on('treeselected', this.onTreeSelected, this);
  $rootScope.$on('onButtonNewTree', $scope.addTree);
})


//
// ADD TREE MODAL CONTROLLER
//
.controller('EditTreeModalController', function($scope, $window, $compile, close, treeId) {
  $scope.treeId = treeId;
  $scope.close = function(result) { close(result); };

  $scope.removeTree = function(id) {
    $window.app.editor.removeTree(id);
  }
});
angular.module('app.tree')

.directive('treepanel', function() {
  return {
    restrict: 'E',
    controller: 'TreeController',
    templateUrl: 'app/tree/tree.html'
  }
});
angular.module('app.property', [])

.controller('PropertyController', function($scope, $timeout, $compile, $window) {
  // DYNAMIC ROW
  this.panel = angular.element(
    document.querySelector('#property-panel')
  );
  this.table = angular.element(
    document.querySelector('#property-properties-table>tbody')
  );
  this.template = '\
    <tr>\
      <td><input id="key" type="text" value="{0}" onkeyup="element(this).updateProperties(this);" placeholder="key" /></td>\
      <td><input id="value" type="text" value="{1}" onkeyup="element(this).updateProperties(this);" placeholder="value" /></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';
  
  var this_ = this;
  $scope.addRow = function(key, value) {
    if (typeof key == 'undefined') key = '';
    if (typeof value == 'undefined') value = '';
    var template = this_.template.format(key, value);
    this_.table.append($compile(template)($scope));
  }

  // SELECTION/DESELECTION
  $scope.block = null;
  this.updateProperties = function() {
    if ($window.app.editor.selectedBlocks.length === 1) {
      var block = $window.app.editor.selectedBlocks[0];

      this_.table.html('');
      var domTitle = document.querySelector('#property-panel #title');
      var domDescription = document.querySelector('#property-panel #description');

      domTitle.value = block.title;
      domDescription.value = block.description;

      for (key in block.properties) {
        $scope.addRow(key, block.properties[key]);
      }
    } else {
      var block = null;
    }


    // timeout needed due to apply function
    // apply is used to update the view automatically when the scope is changed
    $timeout(function() {
      $scope.$apply(function() {
        $scope.block = block;
      });
    }, 0, false);
  }
  $window.app.editor.on('blockselected', this.updateProperties, this);
  $window.app.editor.on('blockdeselected', this.updateProperties, this);
  $window.app.editor.on('treeselected', this.updateProperties, this);
  this.updateProperties();

  // UPDATE PROPERTIES ON NODE
  $scope.updateProperties = function() {
    var domTitle = document.querySelector('#property-panel #title');
    var domDescription = document.querySelector('#property-panel #description');
    var domKeys = document.querySelectorAll('#property-panel #key');
    var domValues = document.querySelectorAll('#property-panel #value');

    var title = domTitle.value;
    var description = domDescription.value;
    var properties = {};

    for (var i=0; i<domKeys.length; i++) {
      var key = domKeys[i].value;
      var value = domValues[i].value;

      // verify if value is numeric
      if (!isNaN(value) && value !== '') {
        value = parseFloat(value);
      }

      if (key) {
        properties[key] = value;
      }
    }
    
    $window.app.editor.editBlock(
      $scope.block,
      {title: title, description:description, properties:properties}
    )
  }
})

.directive('propertypanel', function() {
  return {
    restrict: 'E',
    transclude: true,
    controller: 'PropertyController',
    templateUrl: 'app/property/property.html'
  }
})

.directive('propertyremovable', function() {    
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      element.bind('click', function() {
        element.parent().parent().remove();
        scope.updateProperties();
      });
    }
  };
});