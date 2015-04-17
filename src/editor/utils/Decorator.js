this.b3editor = this.b3editor || {};

(function() {
  "use strict";

 var Decorator = b3.Class(b3.BaseNode);

 var p = Decorator.prototype;

   p.type = "decorator";

   p.__BaseNode_initialize = p.initialize;

   p.initialize = function(settings) {
    settings = settings || {};

    this.__BaseNode_initialize();

    this.child = settings.child || null;
  };

  b3editor.Decorator = Decorator;

})();