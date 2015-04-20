"use strict";

var remote = require('remote');

var loader, app, editor, keyboard;

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

function element(object) {
  return angular.element(object).scope();
}


keyboard = key.noConflict();
app = {};
app.dom = {};
app.dom.page = document.getElementById('page');
app.dom.gameCanvas = document.getElementById('game-canvas');

app.editor = new b3editor.Editor();
app.game = app.editor.canvas;
app.settings = app.editor.settings;

angular.bootstrap(document, ['app']);