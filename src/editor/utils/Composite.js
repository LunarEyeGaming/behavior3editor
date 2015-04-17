this.b3editor = this.b3editor || {};

(function() {
"use strict";

var Composite = b3.Class(b3.BaseNode);

var p = Composite.prototype;

    p.type = "composite";

    p.__BaseNode_initialize = p.initialize;
    p.initialize = function(settings) {
        settings = settings || {};

        this.__BaseNode_initialize();

        this.children = (settings.children || []).slice(0);
    };

b3editor.Composite = Composite;

})();