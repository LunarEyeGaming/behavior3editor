this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  var Project = b3.Class();
  var p = Project.prototype;

  p.initialize = function() {
    this.fileName = null;
    this.nodesPath = null;
    this.trees = [];
  }

  Project.load = function(filename, json) {
    var config = JSON.parse(json);
    var project = new b3editor.Project()
    project.fileName = filename;
    project.nodesPath = path.resolve(filename, config.nodesPath);
    return project;
  }

  p.save = function() {
    var config = {}
    config.nodesPath = path.relative(this.fileName, this.nodesPath);
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
    return this.walk(this.nodesPath, /\.json$/);
  }

  p.findTrees = function() {
    return this.walk(path.dirname(this.fileName), /\.behavior$/);
  }

  b3editor.Project = Project;
}());
