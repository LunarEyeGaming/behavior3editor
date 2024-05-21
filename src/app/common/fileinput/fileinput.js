angular.module('app.fileinput', [])

/**
 * The "b3-file-input" directive applies only to elements. It is a directive for a custom file browsing button, which
 * simply allows for either a folder or a file. This directive also requests an isolate scope, so an element with this
 * directive cannot have any other directives that request an isolate scope. The following are the allowed attributes:
 * * type: can be either "folder" or "file." Specifies whether to select a file or a folder. Applicable for "open" mode
 *   only. If the type is invalid or omitted, "file" is selected instead.
 * * title: the title of the dialog that is opened.
 * * mode: can be either "open" or "save." Specifies whether to open or save a file. If the mode is invalid or omitted,
 *   "open" is selected instead.
 * * filters: the list of filters allowed. 
 *   * Syntax: `<display name 1>/<extension1a>,<extension1b>,...;<display name 2>/<extension1a>,<extension1b>,...;...`
 *   * Example: `A PNG File/png;Other Image File/jpg,bmp;All files/*`
 *   * display names and file extensions follow the same rules as the "name" and "extensions" attribute of each filter 
 *     Electron's dialog.showOpenDialog() function respectively.
 * The button has ID "b3-file-input-button"
 * The display has ID "b3-file-input-display"
 * Consists of a button with the prompt "Browse" followed by the name of the item selected.
 */
.directive('b3FileInput', function() {
  return {
    restrict: 'E',  // Elements only
    scope: {  // Request isolate scope
      type: "@",
      title: "@dialogTitle",
      mode: "@",
      filters: "@"
    },
    controller: ['$scope', function FileInputController($scope, $window) {
      // If the type is invalid or undefined, it is set to "file".
      if ($scope.type != "folder" && $scope.type != "file") {
        $scope.type = "file";
      }

      // If the mode is invalid or undefined, it is set to "open".
      if ($scope.mode != "open" && $scope.mode != "save") {
        $scope.mode = "open";
      }

      // Define dialog arguments.
      var dialogArgs = {};
      dialogArgs.title = $scope.title;

      dialogArgs.properties = [];

      // If the mode is "open"...
      if ($scope.mode == "open") {
        // The "file" type translates to "openFile"
        if ($scope.type == "file")
          dialogArgs.properties.push("openFile");
        // The "folder" type translates to "openDirectory"
        else if ($scope.type == "folder")
          dialogArgs.properties.push("openDirectory");
      }

      // Define the filters (this is the most complicated one, so buckle up!).
      // If the filters are defined...
      if ($scope.filters) {
        // Wrapped in an exception handler to report any errors. No filter is used if something goes wrong.
        try {
          dialogArgs.filters = $scope.filters.split(/;\s*/)  // CONTINUED ON NEXT LINE

          // Semicolons delimit filter options.
          .map(filterOption => {
            // Slash separates the filter name from the filter extensions. This will fail if more than two slashes are 
            // present.
            var [name, extensions] = filterOption.split("/");

            // Commas delimit extensions.
            return {name, extensions: extensions.split(/,\s*/)}
          });
        } catch (e) {
          delete dialogArgs.filters;
          console.error("Error while reading filter: " + e);
        }
      }
      
      $scope.value = null;
      $scope.browse = function() {
        // This displays the dialog to choose a file or folder depending on the type and whether to open or save 
        // depending on the mode.
        if ($scope.mode == "open")
          dialog.showOpenDialog(remote.getCurrentWindow(), dialogArgs, function(filenames) {
            // If the user selected a file...
            if (filenames && filenames.length > 0)
              $scope.$apply(function() {
                // Set the value.
                $scope.value = filenames[0];
              })
          });
        else if ($scope.mode == "save")
          dialog.showSaveDialog(remote.getCurrentWindow(), dialogArgs, function(filename) {
            // If the user selected a file...
            if (filename)
              $scope.$apply(function() {
                // Set the value.
                $scope.value = filename;
              })
          });
        // Nothing happens if the mode is invalid (which should not happen due to the checks above).
      }

      $scope.getDisplayValue = function() {
        // Displays the value if it is defined. Otherwise, displays either "No file chosen" or "No folder chosen" 
        // depending on whether the type is "file" or "folder" respectively.
        return $scope.value != null ? $scope.value : "No " + $scope.type + " chosen";
      }
    }],
    templateUrl: "app/common/fileinput/file-input.html"
  };
});