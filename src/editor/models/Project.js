this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Project = b3.Class();
  var p = Project.prototype;

  p.initialize = function() {
    this.fileName = null;

    // There are two separate variables for all of the nodes paths to ensure compatibility with the unmodified version
    // of this editor.
    this.nodesPath = null;
    this.otherNodesPaths = null;

    this.nodesToExport = null;

    this.trees = [];
  }

  Project.load = function(filename, json) {
    var config = JSON.parse(json);
    var project = new b3editor.Project()
    project.fileName = filename;

    project.nodesPath = path.resolve(filename, config.nodesPath);
  
    // If nodesPaths is defined, resolve each path (which turns them into absolute paths). Otherwise, make 
    // project.nodesPaths an empty list.
    if (config.otherNodesPaths) {
      project.otherNodesPaths = config.otherNodesPaths.map(file => path.resolve(filename, file));
    } else {
      project.otherNodesPaths = [];
    }

    project.nodesToExport = config.nodesToExport || {};
  
    return project;
  }

  p.save = function() {
    var config = {}

    config.nodesPath = path.relative(this.fileName, this.nodesPath);
    config.otherNodesPaths = this.otherNodesPaths.map(file => path.relative(this.fileName, file));
    config.nodesToExport = this.nodesToExport;

    return JSON.stringify(config, null, 2);
  }

  p.walk = function(dir, match, filelist) {
    filelist = filelist || [];
    fs.readdirSync(dir).forEach(file => {
      var full = path.join(dir, file)
      if (fs.statSync(full).isDirectory()) {
        this.walk(full, match, filelist)
      } else if (full.match(match)) {
        filelist.push(full)
      }
    });
    return filelist
  }

  p.findNodes = function() {
    var nodesPathNodes = this.walk(this.nodesPath, /\.nodes$/);

    // If otherNodesPaths is null, simply return nodesPathNodes.
    if (!this.otherNodesPaths) {
      return nodesPathNodes;
    }

    // An association between nodes directories and their corresponding nodes paths.
    var otherNodesPathsNodes = this.otherNodesPaths.map(file => [file, this.walk(file, /\.nodes$/)]);

    return {
      mainPath: this.nodesPath,
      mainNodes: nodesPathNodes,
      otherNodes: otherNodesPathsNodes
    }
  }

  // TODO: consider making a method that does this but caches the result for a certain amount of time afterwards.
  p.findTrees = function() {
    return this.walk(path.dirname(this.fileName), /\.behavior$/);
  }

  /**
   * Adds the provided directory `dir` to the auto-importing list.
   * 
   * @param {string} dir the directory to add
   */
  p.addDir = function(dir) {
    // Convert to absolute, then push.
    this.otherNodesPaths.push(path.resolve(this.fileName, dir));
  }

  /**
   * Removes the provided directory `dir` from the auto-importing list. Has no effect if no more directories can be
   * removed.
   * 
   * @param {string} dir the directory to remove
   */
  p.removeDir = function(dir) {
    // If no more directories can be removed...
    if (!this.canRemoveDir())
      return;  // Cancel the operation.

    var absoluteDir = path.resolve(this.fileName, dir);  // Convert to absolute

    // If the directory is the first directory in the list...
    if (absoluteDir == this.nodesPath) {
      // Replace the first directory with a directory from this.otherNodesPaths.
      this.nodesPath = this.otherNodesPaths.pop();
    } else {  // Otherwise...
      // Find directory
      var dirIdx = this.otherNodesPaths.indexOf(absoluteDir);

      // If the directory is found in the other directories...
      if (dirIdx != -1)
        // Delete the directory
        this.otherNodesPaths.splice(dirIdx, 1);
    }
  }

  /**
   * Returns whether or not the directory `dir` is in the auto-importing list.
   * 
   * @param {string} dir the directory to find
   * @returns true if `dir` is in `this.otherNodesPaths` or is `this.nodesPath`, false otherwise.
   */
  p.containsDir = function(dir) {
    var absoluteDir = path.resolve(this.fileName, dir);
    // Convert to absolute, then return true if the directory is `this.nodesPath` or resulting index is not -1, false 
    // otherwise.
    return this.nodesPath == absoluteDir || this.otherNodesPaths.indexOf(absoluteDir) != -1;
  }

  /**
   * Returns whether or not one more directory can be removed from the project.
   * 
   * @returns true if the project's list of directories has a length of at least two.
   */
  p.canRemoveDir = function() {
    return this.otherNodesPaths.length > 0;
  }

  b3editor.Project = Project;
}());
