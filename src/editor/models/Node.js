this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Node = b3.Class();
  var p = Node.prototype;

  p.initialize = function() {
    this.spec = null;
    this.name = null;
    this.title = null;
    this.type = null;
    this.description = null;
    this.properties = null;
  }

  b3editor.Node = Node;
}());
