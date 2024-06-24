angular.module('app.project', ['app.fileinput'])

//
// NEW PROJECT MODAL CONTROLLER
//
.controller('NewProjectModalController', function($scope, $window, $compile, close) {
  $scope.close = function(result) { close(result); };

  this.nodeDirTemplate = '\
    <tr>\
      <td><b3-file-input class="abbreviated-dir" dialog-title="Select Path for Nodes" mode="open" type="folder"/></td>\
      <td><a href="#" propertyremovable class="button alert right">-</a></td>\
    </tr>\
  ';

  this.showError = function(msg) {
    $window.app.editor.notifyError(msg);
  }

  var this_ = this;

  $scope.addNodeDir = function() {
    var template = this_.nodeDirTemplate.format();
    var propertiesTable = angular.element(
      document.querySelectorAll('#newproject-nodedirs-table>tbody')
    );
    propertiesTable.append($compile(template)($scope));
  }

  // Creates the project and closes the modal.
  $scope.createProject = function() {
    // Get the values.
    var domProjectPath = document.querySelector("#newproject-projectpath #b3-file-input-value");
    var domNodeDirs = document.querySelectorAll("#newproject-nodedirs #b3-file-input-value");

    var projectPath = domProjectPath.value;
    // If the project path is not defined...
    if (!projectPath) {
      // Report the error message and abort.
      this_.showError("Please select a project path");
      return;
    }

    var nodeDirs = [];

    // Build the list of nodes directories that are defined.
    domNodeDirs.forEach(elt => {
      // If the value is defined...
      if (elt.value)
        nodeDirs.push(elt.value);  // Add it
    });

    // If no directories are defined...
    if (nodeDirs.length == 0) {
      // Report the error message and abort.
      this_.showError("Please select a path to import your nodes");
      return;
    }

    // Initialize project.
    var project = new b3editor.Project();
    project.fileName = projectPath;
    project.nodesPath = nodeDirs[0];
    project.otherNodesPaths = nodeDirs.slice(1);
    project.nodesToExport = {};

    // Save project.
    var editor = $window.app.editor;
    fs.writeFile(projectPath, project.save(), function(err) {
      if (err) this_.showError(err);

      editor.loadProject(project);
    })

    close("Yes");
  }
});