# Reshape Layouts

[![npm](https://img.shields.io/npm/v/reshape-layouts.svg?style=flat-square)](https://npmjs.com/package/reshape-layouts)
[![tests](https://img.shields.io/travis/reshape/layouts.svg?style=flat-square)](https://travis-ci.org/reshape/layouts?branch=master)
[![dependencies](https://img.shields.io/david/reshape/layouts.svg?style=flat-square)](https://david-dm.org/reshape/layouts)
[![coverage](https://img.shields.io/coveralls/reshape/layouts.svg?style=flat-square)](https://coveralls.io/r/reshape/layouts?branch=master)

Layout inheritance using `block` and `extend`, inspired by ([jade/pug](http://jade-lang.com/reference/inheritance/)).

### Installation

`npm i reshape-layouts --save`

### Usage

Let's say we have a base template:

`base.html`
```html
<html>
    <head>
        <block name='title'>
          <title>Default Title</title>
        </block>
    </head>

    <body>
        <div class="content">
           <block name="content"></block>
        </div>
        <footer>
            <block name="footer">footer content</block>
        </footer>
    </body>
</html>
```

Now we can inherit this template. All defined blocks inside `<extends>` will
replace the blocks with the same name in the parent template. If the block is not defined inside `<extends>` its content in the parent template remains the same.

In the example the blocks `title` and `content` will be replaced and
the block `footer` will remain unchanged:

```js
const reshape = require('reshape')
const layouts = require('reshape-layouts')

const html = '<extends src="base.html">' +
               '<block name="title"><title>How to use reshape-layouts</title></block>' +
               '<block name="content">Read the documentation</block>'
             '</extends>'

reshape({
  plugins: layouts({
    encoding: 'utf8', // Parent template encoding (default: 'utf8')
    root: './' // Path to parent template directory (default: './')
  })
}).process(html)
  .then((res) => res.output())
```

The final HTML will be:

```html
<html>
  <head>
    <title>How to use reshape-layouts</title>
  </head>

  <body>
    <div class="content">Read the documentation</div>
    <footer>footer content</footer>
  </body>
</html>
```

#### Append & Prepend

It's also possible to append and prepend block's content

```js
const reshape = require('reshape')
const layouts = require('reshape-layouts')

const html = '<extends src="base.html">' +
               '<block name="title" type="prepend">How to use reshape-layouts</block>' +
               '<block name="content">Read the documentation</block>' +
               '<block name="footer" type="append">— 2016</block>'
           '</extends>'

reshape({ plugins: layouts() })
  .process(html)
  .then((res) => res.output())
```

The final HTML will be:

```html
<html>
  <head>
    <title>How to use reshape-layouts — Github</title>
  </head>
  <body>
    <div class="content">Read the documentation</div>
    <footer>footer content — 2016</footer>
  </body>
</html>
```

### Caveats

There are a number of tags that have their contents parsed as plaintext and cannot contain nested html tags. If you place a `block` tag inside any of these elements, it will not behave as expected, and instead will be rendered as plaintext. These are the tags that are content-only: `title`, `noscript`, `noframes`, `style`, `script`, `xmp`, `iframe`, `noembed`.

### Options

All options are optional, none are required.

| Name | Description | Default |
| ---- | ----------- | ------- |
| **root** | root to resolve layout paths from | reshape `filename` option |
| **encoding** | encoding with which to read layout files | `utf8` |

### Reporting Dependencies

This plugin will report its dependencies in the standard format as dictated by [reshape-loader](https://github.com/reshape/loader) if you pass `dependencies: []` as an option to reshape when it runs. Dependencies will be available on the output object under the `dependencies` key. For example:

```js
const reshape = require('reshape')
const include = require('reshape-layouts')

reshape({ plugins: [layouts()], dependencies: []})
  .process(someHtml)
  .then((res) => {
    console.log(res.dependencies)
    console.log(res.output())
  })
```

If you are using this with webpack, reshape-loader takes care of the dependency reporting and you don't have to do anything 😁

### License & Contributing

- Licensed under [MIT](LICENSE.txt)
- See the [contributing guide](contributing.md)
