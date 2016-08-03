const {app,BrowserWindow} = require('electron'); 

var mainWindow = null;

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 1600, height: 900});

  mainWindow.loadURL('file://' + __dirname + '/../../../src/dev.html');
  mainWindow.openDevTools({detach : true})

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});