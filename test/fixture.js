'use strict';

var d = document;
exports.element = document.createElement('div');
exports.otherElement = d.createElement('div');
exports.first = require('foo').mastermind('first value', 'second value');
var foo = require('foo');
exports.second = foo.mastermind('first value', 'second value');
exports.arr = foo.arrayify('a0', 'b1', 'c2', 'd3');
exports.max = function () { return max(this.x, this.y); }.call({x: 10, y: 5});
exports.fib = foo.fib(10 + 5);

function sumFast() {
  var args = Array.prototype.slice.call(arguments);
  return args.reduce(function (a, b) { return a + b; }, 0);
}
function sumSlow() {
  return Array.prototype.slice.call(arguments).reduce(function (a, b) { return a + b; }, 0);
}
exports.sumFast = sumFast;
exports.sumSlow = sumSlow;
