angular.module('app.node')

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
        var data = e.dataTransfer.getData("text");
        // If e.preventDefault is defined and the data contains a node name...
        if (e.preventDefault && data && data.startsWith("node-")) {
          e.preventDefault(); // Necessary. Allows us to drop (default behavior is not to allow us to drop).
        }
        return false;
      });
      element.bind("drop", function(e) {
        var data = e.dataTransfer.getData("text");

        // If the text is defined and starts with "node-" (and is thus valid)...
        if (data && data.startsWith("node-")) {
          if (e.preventDefault) {
            e.preventDefault(); // Necessary. Allows us to drop.
          }
          if (e.stopPropagation) {
            e.stopPropagation(); // Necessary. Allows us to drop.
          }
          // TODO: encapsulate this inside the editor
          var point = $window.app.editor.canvas.getLocalMousePosition(e.clientX, e.clientY);
          $window.app.editor.pushCommandTree('AddBlock', {
            blockName: data.replace('node-', ''), 
            xPos: point.x,
            yPos: point.y
          });
        }
      })
    }
  }
});