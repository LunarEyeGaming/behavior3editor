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
  /**
   * Same as `string.format()` but also HTML-escapes the remaining arguments before passing them into the `format` 
   * method.
   * 
   * @param {string} fmt the string to format
   * @param {*} ...args the format arguments
   */
  b3editor.formatHtml = function() {
    var formatString = arguments[0];
    // Build a list of arguments to use for the format method.
    var formatArgs = [];

    for (var i = 1; i < arguments.length; i++) {
      // Add escaped argument.
      formatArgs.push(b3editor.escapeHtml(arguments[i]));
    }

    // Forward the list formatArgs into the format method (formatString is `this`).
    return formatString.format.apply(formatString, formatArgs);
  }

  /**
   * Returns `true` if two JSON values `first` and `second` are equal, `false` otherwise.
   * 
   * @param {*} first the first JSON value to compare
   * @param {*} second the second JSON value to compare
   * @returns whether or not they are equal
   */
  b3editor.jsonEquals = function(first, second) {
    // If both are non-null objects (or arrays)...
    if (typeof first === "object" && typeof second === "object" && first !== null && second !== null) {
      // If both are arrays...
      if (Array.isArray(first) && Array.isArray(second)) {
        // If the lengths do not match...
        if (first.length !== second.length)
          return false;  // Stop and return false.

        // For each pair of elements...
        for (var i = 0; i < first.length; i++) {
          // If the ith elements in the respective arrays do not match...
          if (!b3editor.jsonEquals(first[i], second[i]))
            return false;  // Stop and return false
        }

        return true;
      }  // Otherwise, if neither are arrays...
      else if (!Array.isArray(first) && !Array.isArray(second)) {
        // Return false if the number of entries do not match.
        if (Object.keys(first).length != Object.keys(second).length)
          return false;

        // Return false if any of the values in first do not match any of the values in second. This also returns false
        // if the set of keys doesn't match.
        for (var k in first) {
          if (!b3editor.jsonEquals(first[k], second[k]))
            return false;
        }

        return true;
      } else {
        // Types do not match, so return false.
        return false;
      }
    }

    // Use simple comparison to determine whether or not they are equal. This code is never reached if both values are
    // objects.
    return first === second;
  }
}());
