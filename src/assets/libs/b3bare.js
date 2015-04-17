/**
 * b3
 * 
 * Copyright (c) 2014 Renato de Pontes Pereira.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to 
 * deal in the Software without restriction, including without limitation the 
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is 
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
**/

this.b3 = this.b3 || {};

(function() {
"use strict";

b3.createUUID = function() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    // bits 12-15 of the time_hi_and_version field to 0010
    s[14] = "4";

    // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);

    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}

b3.Class = function(baseClass) {
    // create a new class
    var cls = function(params) {
        this.initialize(params);
    };
    
    // if base class is provided, inherit
    if (baseClass) {
        cls.prototype = Object.create(baseClass.prototype);
        cls.prototype.constructor = cls;
    }
    
    // create initialize if does not exist on baseClass
    if(!cls.prototype.initialize) {
        cls.prototype.initialize = function() {};
    }

    return cls;
}

})();

this.b3 = this.b3 || {};

(function() {
"use strict";

var BaseNode = b3.Class();

var p = BaseNode.prototype;

    /**
     * Node ID.
     *
     * @property id
     * @type {String}
     * @readonly
    **/

    /**
     * Node name. Must be a unique identifier, preferable the same name of the 
     * class. You have to set the node name in the prototype.
     *
     * @property name
     * @type {String}
     * @readonly
    **/
    p.name = null;

    /**
     * Node type. Must be `b3.COMPOSITE`, `b3.DECORATOR`, `b3.ACTION` or 
     * `b3.CONDITION`. This is defined automatically be inheriting the 
     * correspondent class.
     *
     * @property type
     * @type constant
     * @readonly
    **/
    p.type = null;

    /**
     * Node title.
     *
     * @property title
     * @type {String}
     * @optional
     * @readonly
    **/
    p.title = null;

    /**
     * Node description.
     *
     * @property description
     * @type {String}
     * @optional
     * @readonly
    **/
    p.description = null;

    /**
     * A dictionary (key, value) describing the node parameters. Useful for 
     * defining parameter values in the visual editor. Note: this is only 
     * useful for nodes when loading trees from JSON files.
     *
     * @property parameters
     * @type {Object}
     * @readonly
    **/
    p.parameters = null;

    /**
     * A dictionary (key, value) describing the node properties. Useful for 
     * defining custom variables inside the visual editor.
     *
     * @property properties
     * @type {Object}
     * @readonly
    **/
    p.properties = null;

    /**
     * Initialization method.
     *
     * @method initialize
     * @constructor
    **/
    p.initialize = function() {
        this.id          = b3.createUUID();
        this.title       = this.title || this.name;
        this.description = '';
        this.parameters  = {};
        this.properties  = {};
    }
    
b3.BaseNode = BaseNode;

})();