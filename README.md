# inline-code

[![Greenkeeper badge](https://badges.greenkeeper.io/ForbesLindesay/inline-code.svg)](https://greenkeeper.io/)

A library to help you inline code in JavaScript.  It automatically handles arguments that contain references to `this` or arguments that are complex and get used multiple times in the inlined function.  This makes it really simple to use.  It also supports using temporary variables in inline functions.  If you start a variable with an `_` it will be automatically defined for you and guaranteed not to conflict with the user's program.  This is super useful.

If you return "expressions" they will be inlined perfectly.  If you return "statements" it will be assumed that the statements should replace whatever the next statement up in the tree is.  See the Array.prototype.slice.call inliner for an example of this.

[![Build Status](https://img.shields.io/travis/ForbesLindesay/inline-code/master.svg)](https://travis-ci.org/ForbesLindesay/inline-code)
[![Dependency Status](https://img.shields.io/david/ForbesLindesay/inline-code.svg)](https://david-dm.org/ForbesLindesay/inline-code)
[![NPM version](https://img.shields.io/npm/v/inline-code.svg)](https://www.npmjs.org/package/inline-code)

## Installation

    npm install inline-code

## Usage

input.js
```js
var d = document;
exports.element = document.createElement('div');
exports.otherElement = d.createElement('div');
exports.first = require('foo').mastermind('first value', 'second value');
var foo = require('foo');
exports.second = foo.mastermind('first value', 'second value');
exports.arr = foo.arrayify('a0', 'b1', 'c2', 'd3');
exports.max = max(10, 5);
function sumFast() {
  var args = Array.prototype.slice.call(arguments);
  return args.reduce(function (a, b) { return a + b; }, 0);
}
function sumSlow() {
  return Array.prototype.slice.call(arguments).reduce(function (a, b) { return a + b; }, 0);
}
exports.sumFast = sumFast;
exports.sumSlow = sumSlow;
```

build.js
```js
fs.writeFileSync(__dirname + '/output.js', replace(fs.readFileSync(__dirname + '/input.js', 'utf8'), {
  globals: {
    document: {
      createElement: function (args) {
        if (args.length === 1 && args[0].TYPE === 'String') {
          return '"<' + args[0].value + '>"';
        } else {
          return '("<" + $args[0] + ">")';
        }
      }
    },
    max: function (args) {
      return 'Math.max($args)';
    },
    Array: {
      prototype: {
        slice: {
          call: function (args, stack) {
            var start = false;
            var name = null;
            if (stack[stack.length - 2].TYPE === 'Assign' &&
                stack[stack.length - 3].TYPE === 'SimpleStatement' &&
                stack[stack.length - 2].left.TYPE === 'SymbolRef' &&
                stack[stack.length - 2].operator === '=') {
              name = stack[stack.length - 2].left.name;
              start = name + ' = [];';
            }
            if (stack[stack.length - 2].TYPE === 'VarDef' &&
                stack[stack.length - 3].TYPE === 'Var' &&
                stack[stack.length - 3].definitions.length === 1) {
              name = stack[stack.length - 2].name.name;
              start = 'var ' + name + ' = [];';
            }
            if (start) {
              return start +
                'for (var _i = 0; _i < $args[0].length; _i++) {' +
                name + '.push($args[0][_i])' +
                '}';
            }
            // only inline when it can be done as a simple statement, e.g.
            // var args = Array.prototype.slice(arguments);
          }
        }
      }
    }
  },
  requires: {
    foo: {
      mastermind: function (args) {
        return '$args[0] + "." + $args[1]';
      },
      arrayify: function (args) {
        return '[$args, "end"]';
      }
    }
  }
}));
```

output.js
```js
"use strict";

exports.element = "<div>";

exports.otherElement = "<div>";

exports.first = "first value" + "." + "second value";

exports.second = "first value" + "." + "second value";

exports.arr = [ "a0", "b1", "c2", "d3", "end" ];

exports.max = Math.max(10, 5);

function sumFast() {
    var args = [];
    for (var _i_0 = 0; _i_0 < arguments.length; _i_0++) {
        args.push(arguments[_i_0]);
    }
    return args.reduce(function(a, b) {
        return a + b;
    }, 0);
}

function sumSlow() {
    return Array.prototype.slice.call(arguments).reduce(function(a, b) {
        return a + b;
    }, 0);
}

exports.sumFast = sumFast;

exports.sumSlow = sumSlow;
```

## License

  MIT
