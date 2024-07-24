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
      this.highlightReplacement = function(match) {
        return '<span class="highlight">' + match + '</span>';
      }
      /**
       * Finds all occurrences (case-insensitive) of `matchStr` in `str` and replaces them with the result of applying
       * `replacer` to each occurrence, returning the result. The original string is unmodified.
       * 
       * @precondition `matchStr !== ""`
       * @param {string} str the string to modify
       * @param {string} matchStr the substring to replace
       * @param {(match: string) => string} replacer a function that returns the replacement string for a given match
       * @returns `str` with all occurrences of `matchStr` replaced with their corresponding results from `replacer`
       */
      this.replaceAll = function(str, matchStr, replacer) {
        var newStr = "";
        // For each character index in str that can possibly be the start of a match...
        for (var i = 0; i < str.length - (matchStr.length - 1); i++) {  
          var match = "";

          // For each character index in matchStr...
          for (var j = 0; j < matchStr.length; j++) {
            // Attempt to match character j in matchStr with character i + j in str.
            var matchStrCh = matchStr[j];
            var strCh = str[i + j];
            // If they match...
            if (matchStrCh.toLowerCase() === strCh.toLowerCase()) {
              // Add character to match
              match += strCh;
            } else {
              // Add the first character that was attempted in the match to the new string, set match to empty string,
              // and cancel match attempt for current position by breaking.
              newStr += str[i];
              match = "";
              break;
            }
          }

          // If a match was found...
          if (match) {
            // Add the replacement version of the match to the new string.
            newStr += replacer(match);
            // Skip over remaining characters found in the match so that the next match attempt does not start in any 
            // part of the matched string.
            i += matchStr.length - 1;
          }
        }

        // Add remaining characters that were not processed (starting at where "i" left off).
        while (i < str.length) {
          newStr += str[i];
          i++;
        }

        return newStr;
      }
      this.highlightText = $compile("<span>" + b3editor.escapeHtml($scope.str) + "</span>")($scope);  // Initial value.

      /**
       * Updates the highlighted text to display.
       */
      this.updateHighlight = function() {
        this.highlightText.remove();  // Remove old highlight text HTML element.

        // Escape the string to search through. Escape the search text too so that it matches.
        var escapedStr = b3editor.escapeHtml($scope.str);
        var escapedSearchText = b3editor.escapeHtml($scope.searchText);

        // If the search text is defined and not an empty string...
        if ($scope.searchText)
          // Replace all instances (using the "g" flag to do so) of the search text in the string being used with the
          // highlight span template. Also make it case-insensitive using the "i" flag. To preserve casing, the match
          // must be captured.
          var replaced = this.replaceAll(escapedStr, escapedSearchText, this.highlightReplacement);
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