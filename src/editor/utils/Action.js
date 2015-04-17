this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Action = b3.Class(b3.BaseNode);

  var p = Action.prototype;

  p.type = "action";

  p.__BaseNode_initialize = p.initialize;
  p.initialize = function() {
    this.__BaseNode_initialize();
  }

  b3editor.Action = Action;

})();