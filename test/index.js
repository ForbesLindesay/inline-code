'use strict';

var assert = require('assert');
var fs = require('fs');
var test = require('testit');
var replace = require('../');

// exports.element = document.createElement('div');
// exports.foo = require('foo').mastermind('arg1', 'arg2');

test('it can do the transformation', function () {
  fs.writeFileSync(__dirname + '/output.js', replace(fs.readFileSync(__dirname + '/fixture.js', 'utf8'), {
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
        return 'function () { return Math.max($args); }()';
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
        },
        fib: function (args) {
          return 'function () { _current = 1; _next = 1; _index = 1; while (_index < $args[0]) {' +
            '_temp = _next;_next = _current + _next; _current = _temp;_index++;' +
            '} return _current; }()';
        }
      }
    }
  }));
});
test('the transformed file works', function () {
  var output = require('./output');
  assert(output.element === '<div>');
  assert(output.otherElement === '<div>');
  assert(output.first = 'first value.second value');
  assert(output.second = 'first value.second value');
  assert.deepEqual(output.arr, [ "a0", "b1", "c2", "d3", "end" ]);
  assert(output.max = 10);
  assert.equal(output.fib, 610);
  assert.equal(output.sumFast(1, 2, 3), 6);
  assert.equal(output.sumSlow(1, 2, 3), 6);
});
