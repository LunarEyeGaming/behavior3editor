angular.module("app.highlight", [])

/**
 * A factory to enable the sharing of search text data. Note that this sharing of search text data may be global, thus
 * making the search highlighting system not scalable.
 */
.factory("SearchHighlightFactory", function() {
  return {
    searchText: ''
  }
})

.directive("b3Highlightable", function() {
  return {
    restrict: "E",
    scope: {
      str: "=",  // the contents to make highlightable
      searchText: "="  // The search text to use
    },
    controller: ["$scope", "$window", "$compile", "$element", 
    function($scope, $window, $compile, $element) {
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
      
      this.escapeHtml = function(string) {
        return String(string).replace(/[&<>"'`=\/]/g, function fromEntityMap (s) {
          return entityMap[s];
        });
      }
      // ---------------------------- End of aforementioned substantial portion of software. ---------------------------
      this.highlightTemplate = '<span class="highlight">$1</span>';  // $1 is used for the capture group system.
      this.highlightText = $compile("<span>" + this.escapeHtml($scope.str) + "</span>")($scope);  // Initial value.

      /**
       * Updates the highlighted text to display.
       */
      this.updateHighlight = function() {
        this.highlightText.remove();  // Remove old highlight text HTML element.

        // Escape the string to search through. Escape the search text too so that it matches.
        var escapedStr = this.escapeHtml($scope.str);
        var escapedSearchText = this.escapeHtml($scope.searchText);

        // If the search text is defined and not an empty string...
        if ($scope.searchText)
          // Replace all instances (using the "g" flag to do so) of the search text in the string being used with the
          // highlight span template. Also make it case-insensitive using the "i" flag. To preserve casing, the match
          // must be captured.
          var replaced = escapedStr.replace(new RegExp("(" + escapedSearchText + ")", "gi"), 
              this.highlightTemplate);
        else
          var replaced = escapedStr;  // Leave the string unchanged.
    
        // Compile the HTML, wrapping it in <span> to prevent a nosel Angular error.
        this.highlightText = $compile("<span>" + replaced + "</span>")($scope);

        // Find the place to embed the highlight text.
        var highlightRegion = angular.element($element[0].querySelector("#highlight-region"));
    
        // Embed it.
        highlightRegion.append(this.highlightText);
      }
    
      var this_ = this;
    
      // Watch for changes in the search information / search text.
      $scope.$watch("searchText", function() { this_.updateHighlight() });

      // Watch for changes in the string to search too.
      $scope.$watch("str", function() { this_.updateHighlight() });
    }],
    transclude: true,
    templateUrl: "app/highlight/highlight.html"
  }
})