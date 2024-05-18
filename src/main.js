"use strict";

var remote = require('electron').remote;
const {dialog} = remote;
var fs = remote.require('fs');
var path = remote.require('path');

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

function __runTests() {
  var testRunner = require('./test/testerMain');
  testRunner.main();
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

// COMMENT THIS OUT IN PRODUCTION VERSIONS.
// __runTests();
