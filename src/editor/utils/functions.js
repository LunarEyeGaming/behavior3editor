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
}());
