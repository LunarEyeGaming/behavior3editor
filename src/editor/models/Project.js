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
    this.trees = [];
  }

  Project.load = function(filename, json) {
    var config = JSON.parse(json);
    var project = new b3editor.Project()
    project.fileName = filename;

    project.nodesPath = path.resolve(filename, config.nodesPath);
  
    // If nodesPaths is defined, resolve each path. Otherwise, make project.nodesPaths an empty list.
    if (config.otherNodesPaths) {
      project.otherNodesPaths = config.otherNodesPaths.map(file => path.resolve(filename, file));
    } else {
      project.otherNodesPaths = [];
    }
  
    return project;
  }

  p.save = function() {
    var config = {}
    config.nodesPath = path.relative(this.fileName, this.nodesPath);
    config.otherNodesPaths = this.otherNodesPaths.map(file => path.relative(this.fileName, file))
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

    var otherNodesPathsNodes = this.otherNodesPaths.map(file => this.walk(file, /\.nodes$/));
    // Concat all otherNodesPathNodes into one list, then concatenate nodesPathNodes with it.
    var allNodes = [];
    otherNodesPathsNodes.forEach(fileList => {
      allNodes = allNodes.concat(fileList);
    })
    allNodes = allNodes.concat(nodesPathNodes);
    return allNodes;
  }

  p.findTrees = function() {
    return this.walk(path.dirname(this.fileName), /\.behavior$/);
  }

  b3editor.Project = Project;
}());
