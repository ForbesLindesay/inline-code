'use strict';

var d = document;
exports.element = document.createElement('div');
exports.otherElement = d.createElement('div');
exports.first = require('foo').mastermind('first value', 'second value');
var foo = require('foo');
exports.second = foo.mastermind('first value', 'second value');
exports.arr = foo.arrayify('a0', 'b1', 'c2', 'd3');
exports.max = max(10, 5);
