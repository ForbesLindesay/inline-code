# inline-code

A library to help you inline code in JavaScript

[![Build Status](https://img.shields.io/travis/ForbesLindesay/inline-code/master.svg)](https://travis-ci.org/ForbesLindesay/inline-code)
[![Dependency Status](https://img.shields.io/gemnasium/ForbesLindesay/inline-code.svg)](https://gemnasium.com/ForbesLindesay/inline-code)
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
```

## License

  MIT
