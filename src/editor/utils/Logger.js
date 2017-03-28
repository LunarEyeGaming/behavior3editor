this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   *  Logger
  **/
  var Logger = b3.Class();
  var p = Logger.prototype;

    p.initialize = function(path) {
      fs.writeFileSync("../error.log", "");
    }
    p.timestamp = function() {
      var date = new Date();
      return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    }
    p.info = function(message) {
      this.write(this.timestamp() + " INFO: " + message);
      if (this.onInfo) {
        this.onInfo(message)
      }
    }
    p.warn = function(message) {
      this.write(this.timestamp() + " WARNING: " + message);
      if (this.onWarning) {
        this.onWarning(message)
      }
    }
    p.error = function(message) {
      this.write(this.timestamp() + " ERROR: " + message);
      if (this.onError) {
        this.onError(message)
      }
    }
    p.write = function(message) {
      fs.appendFile("../error.log", message + "\n", (err) => {
        if (err) throw err;
      })
      console.log(message)
    }

  b3editor.Logger = Logger;
}());
