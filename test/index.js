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
        return 'Math.max($args)';
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
});
test('the transformed file works', function () {
  var output = require('./output');
  assert(output.element === '<div>');
  assert(output.otherElement === '<div>');
  assert(output.first = 'first value.second value');
  assert(output.second = 'first value.second value');
  assert.deepEqual(output.arr, [ "a0", "b1", "c2", "d3", "end" ]);
  assert(output.max = 10);
});
