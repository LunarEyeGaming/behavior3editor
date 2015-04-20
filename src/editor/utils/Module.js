this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Module = b3.Class(b3.BaseNode);

  var p = Module.prototype;

  p.type = "module";
  p.path = "";

  p.__BaseNode_initialize = p.initialize;
  p.initialize = function() {
    this.__BaseNode_initialize();
  }

  b3editor.Module = Module;

})();