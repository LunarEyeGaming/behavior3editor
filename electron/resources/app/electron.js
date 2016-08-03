var app = require('app'); 
var BrowserWindow = require('browser-window');

require('crash-reporter').start();

var mainWindow = null;

app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 1600, height: 900});

  mainWindow.loadUrl('file://' + __dirname + '/../../../src/dev.html');
  mainWindow.openDevTools({detach : true})

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});