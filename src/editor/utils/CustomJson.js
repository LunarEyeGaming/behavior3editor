CustomJSON = {}

CustomJSON.stringify = function(value, replacer, spaces, depth) {
  if (!spaces) spaces = 0;
  if (!depth) depth = 0;
  var indent = ' '.repeat(spaces).repeat(depth);
  var type = typeof value
  var output = '';
  if (type == 'boolean') {
    output += value.toString();
  } else if (type == 'number') {
    output += value.toString();
  } else if (type == 'string') {
    output += JSON.stringify(value);
  } else if (value == null|| type == 'undefined') {
    output += 'null';
  } else if (type == 'object') {
    var newIndent = indent + ' '.repeat(spaces);
    var nl = spaces > 0 ? '\n' : '';
    if (Array.isArray(value)) {
      output += '[';
      for (var i = 0; i < value.length; i++) {
        output += nl + newIndent + CustomJSON.stringify(value[i], replacer, spaces, depth + 1);
        if (i != value.length - 1) {
          output += ',';
          if (spaces == 0)
            output += ' ';
        } else {
          output += nl+indent;
        }
      }
      output += ']';
    } else {
      output += '{';
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        if (replacer) {
          output += nl + newIndent + '"'+k+'": ' + replacer(k, value[k], spaces, depth);
        } else {
          output += nl + newIndent + '"'+k+'": ' + CustomJSON.stringify(value[k], replacer, spaces, depth + 1);
        }
        if (i != keys.length - 1) {
          output += ',';
          if (spaces == 0)
            output += ' ';
        } else {
          output += nl+indent;
        }
      }
      output += '}';
    }
  }
  return output
}
