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
      this.highlightTemplate = '<span class="highlight">$1</span>';  // $1 is used for the capture group system.
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