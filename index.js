'use strict';

var assert = require('assert');
var uglify = require('uglify-js');


function isRequire(node) {
  assert(node != null);
  return (node.TYPE === 'Call' &&
      node.expression.TYPE === 'SymbolRef' &&
      node.expression.name === 'require' &&
      node.expression.thedef.global === true &&
      node.expression.thedef.undeclared === true &&
      node.args.length === 1 &&
      node.args[0].TYPE === 'String') ? node.args[0].value : false;
}
function isRequireResult(node) {
  assert(node != null);
  if (isRequire(node)) {
    return node.args[0].value;
  } else if (node.TYPE === 'SymbolRef' && node.thedef && node.thedef.init) {
    return isRequireResult(node.thedef.init);
  } else {
    return false;
  }
}
function isGlobal(node) {
  assert(node != null);
  if (node.TYPE === 'SymbolRef' && node.thedef && node.thedef.global && node.thedef.undeclared) {
    return node.name;
  } else if (node.TYPE === 'SymbolRef' && node.thedef && node.thedef.init) {
    return isGlobal(node.thedef.init);
  } else {
    return false;
  }
}
function isArgs(node) {
  return node.TYPE === 'SymbolRef' && node.name === '$args';
}

function replaceCalls(src, replacements) {
  assert(typeof src === 'string', 'Source must be a string');
  var ast = uglify.parse(src)
  ast.figure_out_scope();
  function getFn(node, type) {
    assert(node != null);
    function withType(name) {
      return type === 'New' ? name + 'Constructor' : name;
    }
    var name;
    if (name = isRequireResult(node)) {
      return replacements.requires && replacements.requires[withType(name)];
    } else if (name = isGlobal(node)) {
      return replacements.globals && replacements.globals[withType(name)];
    }
    if (node.TYPE === 'Dot') {
      var parent = getFn(node.expression);
      if (parent) {
        return parent[withType(node.property)];
      }
    }
  }
  ast = ast.transform(new uglify.TreeTransformer(null, function (node) {
    if (node.TYPE === 'Call' || node.TYPE === 'New') {
      var fn = getFn(node.expression, node.TYPE);
      if (fn) {
        var args = node.args;
        var res = fn(args, node.TYPE);
        if (typeof res !== 'string') return res;
        var childAst = uglify.parse('var top_level_result = (' + res + ')');
        childAst = childAst.transform(new uglify.TreeTransformer(null, function (node) {
          var property = null;
          switch (node.TYPE) {
            case 'Call':
            case 'New':
              property = 'args';
              break;
            case 'Array':
              property = 'elements';
              break;
          }
          if (property !== null) {
            var list = node[property];
            var newList = [];
            for (var i = 0; i < list.length; i++) {
              if (!isArgs(list[i])) {
                newList.push(list[i]);
              } else {
                newList = newList.concat(args);
              }
            }
            node[property] = newList;
          }
          if (node.TYPE === 'Sub' && isArgs(node.expression) && node.property.TYPE === 'Number') {
            return args[node.property.value];
          }
        }));
        childAst.figure_out_scope();
        return childAst.variables.get('top_level_result').init;
      }
    }
  }));
  ast.figure_out_scope();
  ast = ast.transform(new uglify.TreeTransformer(null, function (node) {
    var rname, gname;
    if (node.TYPE === 'Var') {
      node.definitions = node.definitions.filter(function (node) {
        if (!node.value) return true;
        var name;
        if (name = isRequireResult(node.value)) {
          if (replacements.requires && replacements.requires[name]) {
            return node.name.thedef.references.length !== 0;
          }
        }
        if (name = isGlobal(node.value)) {
          if (replacements.globals && replacements.globals[name]) {
            return node.name.thedef.references.length !== 0;
          }
        }
        return true;
      });
      if (node.definitions.length === 0) {
        return new uglify.AST_EmptyStatement();
      }
    }
  }));
  return ast.print_to_string({
    beautify: true,
    comments: true
  });
}

module.exports = replaceCalls;
