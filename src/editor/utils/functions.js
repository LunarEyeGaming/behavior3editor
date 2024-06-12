this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  b3editor.extend = function() {
    for(var i=1; i<arguments.length; i++) {
      for(var key in arguments[i]) {
        if(arguments[i].hasOwnProperty(key)) {
          arguments[0][key] = arguments[i][key];
        }
      }
    }
    return arguments[0];
  }

  /**
   * Returns whether or not `float1` and `float2` are equal within `epsilon`.
   * 
   * @param {number} float1 the first float to compare
   * @param {number} float2 the second float to compare
   * @param {number} epsilon the amount of imprecision allowed
   * @returns true if `float1` equals `float2` within a range defined by `epsilon`, false otherwise.
   */
  b3editor.floatEquals = function(float1, float2, epsilon) {
    return float1 - epsilon <= float2 && float2 <= float1 + epsilon;
  }

  // Copyright notice from mustache.js (https://github.com/janl/mustache.js/tree/master)
  /*
    * The MIT License
    *
    * Copyright (c) 2009 Chris Wanstrath (Ruby)
    * Copyright (c) 2010-2014 Jan Lehnardt (JavaScript)
    * Copyright (c) 2010-2015 The mustache.js community
    * 
    * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
    * documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
    * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, 
    * and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
    * 
    * The above copyright notice and this permission notice shall be included in all copies or substantial portions
    * of the Software.
    * 
    * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
    * TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
    * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
    * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    * DEALINGS IN THE SOFTWARE.
    */
  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  b3editor.escapeHtml = function(string) {
    return String(string).replace(/[&<>"'`=\/]/g, function fromEntityMap (s) {
      return entityMap[s];
    });
  }
  // ----------------------------- End of aforementioned substantial portion of software. ------------------------------
}());
