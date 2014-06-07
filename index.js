'use strict';

var assert = require('assert');
var uglify = require('uglify-js');

var PRIMATIVES = [
  'String',
  'Number',
  'Null',
  'NaN',
  'Undefined',
  'Infinity',
  'True',
  'False',
  'This',
  'SymbolRef'
];

function isPrimitive(node) {
  return (node.TYPE === 'Dot' && isPrimitive(node.expression)) || PRIMATIVES.indexOf(node.TYPE) !== -1;
}
function needsThis(node) {
  var needsThis = false;
  node.walk(new uglify.TreeWalker(function (node) {
    if (node.TYPE === 'This') {
      needsThis = true;
    }
    if (node.TYPE === 'SymbolRef' && node.name === 'arguments') {
      needsThis = true;
    }
  }));
  return needsThis;
}
function isSelfCallingFunctionWithSingleReturn(node) {
  if (node.TYPE !== 'Call') return false;
  if (node.expression.TYPE !== 'Function') return;

  node.walk(new uglify.TreeWalker(function (node) {
    if (node.TYPE === 'This') {
      needsThis = true;
    }
    if (node.TYPE === 'SymbolRef' && node.name === 'arguments') {
      needsThis = true;
    }
  }));
}

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
  var tempI = 0;
  function temporaryVariable(name) {
    var t = name + '_' + (tempI++);
    while (ast.enclosed.some(function (node) { return node.name === t; })) {
      t = name + '_' + (tempI++);
    }
    return t;
  }
  ast = ast.transform(new uglify.TreeTransformer(null, function (node) {
    if (node.TYPE === 'Call' || node.TYPE === 'New') {
      var fn = getFn(node.expression, node.TYPE);
      if (typeof fn === 'function') {
        var args = node.args;
        var res = fn(args, this.stack);
        if (typeof res !== 'string') return;
        var isExpression, childAst;
        try {
          childAst = uglify.parse('var top_level_result = (' + res + ')');
          isExpression = true;
        } catch (ex) {
          childAst = uglify.parse(res);
          isExpression = false;
        }
        var argumentCounts = args.map(function () { return 0; });
        var argumentUsedInScope = args.map(function () { return false; });
        var argumentUsedInLoop = args.map(function () { return false; });
        childAst.walk(new uglify.TreeWalker(function (node) {
          var parents = this.stack.map(function (node) {
            return node.TYPE;
          });
          var hasScopeContainer = parents.indexOf('Function') !== -1 || parents.indexOf('Defun') !== -1;
          var hasLoopContainer = parents.indexOf('Do') !== -1 || parents.indexOf('For') !== -1 ||
              parents.indexOf('For') || parents.indexOf('ForIn') || parents.indexOf('With');
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
            var argsRefs = node[property].filter(isArgs).length;
            for (var i = 0; i < argumentCounts.length; i++) {
              argumentCounts[i] += argsRefs;
              if (hasScopeContainer) argumentUsedInScope[i] = true;
              if (hasLoopContainer) argumentUsedInLoop[i] = true;
            }
          }
          if (node.TYPE === 'Sub' && isArgs(node.expression) && node.property.TYPE === 'Number') {
            argumentCounts[node.property.value]++;
            if (hasScopeContainer) argumentUsedInScope[node.property.value] = true;
            if (hasLoopContainer) argumentUsedInLoop[node.property.value] = true;
          }
        }));
        var assignments = [];
        var temporaryVariables = [];
        var temporaryVariableCache = {};
        for (var i = 0; i < args.length; i++) {
          if ((argumentCounts[i] > 1 && !isPrimitive(args[i])) ||
              (argumentCounts[i] > 0 && !isPrimitive(args[i]) && argumentUsedInLoop[i]) ||
              (argumentCounts[i] > 0 && argumentUsedInScope[i] && needsThis(args[i]))) {
            var argname = temporaryVariable('_arg_' + i);
            assignments.push(new uglify.AST_Assign({
              left: new uglify.AST_SymbolRef({name: argname}),
              operator: '=',
              right: args[i]
            }));
            args[i] = new uglify.AST_SymbolRef({name: argname});
            temporaryVariables.push(argname);
          }
        }
        childAst.figure_out_scope();
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
          if ((node.TYPE === 'SymbolVar' || node.TYPE === 'SymbolRef') && node.name[0] === '_') {
            if (!temporaryVariableCache[node.name]) {
              temporaryVariableCache[node.name] = temporaryVariable(node.name);
              if (node.thedef && node.thedef.undeclared) {
                temporaryVariables.push(temporaryVariableCache[node.name]);
              }
            }
            node.name = temporaryVariableCache[node.name];
          }
        }));
        childAst.figure_out_scope();
        var expression =  isExpression ? childAst.variables.get('top_level_result').init : childAst.body;
        for (var i = assignments.length - 1; i >= 0; i--) {
          if (isExpression) {
            expression = new uglify.AST_Seq({
              car: assignments[i],
              cdr: expression
            });
          } else {
            expression.unshift(assignments[i]);
          }
        }
        assert(this.stack.slice().reverse().some(function (parent) {
          if (parent.TYPE === 'Toplevel' || parent.TYPE === 'Function' || parent.TYPE === 'Defun') {
            parent.temporaryVariables = parent.temporaryVariables || [];
            parent.temporaryVariables = parent.temporaryVariables.concat(temporaryVariables);
            // stop the loop
            return true;
          }
          return false;
        }), 'no scope was found');

        if (isExpression) {
          return expression;
        } else {
          assert(this.stack.slice().reverse().some(function (parent) {
            if (parent instanceof uglify.AST_Statement) {
              parent.replacementExpressions = expression;
              // stop the loop
              return true;
            }
            return false;
          }), 'no statement was found');
        }
      }
    } else if (node.temporaryVariables && node.temporaryVariables.length) {
      node.body.unshift(new uglify.AST_Var({
        definitions: node.temporaryVariables.map(function (temp) {
          return new uglify.AST_VarDef({
            name: new uglify.AST_SymbolVar({name: temp})
          });
        })
      }));
    }
    if (Array.isArray(node.body)) {
      var newBody = [];
      node.body.forEach(function (node) {
        if (node.replacementExpressions) {
          newBody = newBody.concat(node.replacementExpressions);
        } else {
          newBody.push(node);
        }
      });
      node.body = newBody;
    }
  }));
  ast.figure_out_scope();
  // remove newly un-used variable declarations
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
