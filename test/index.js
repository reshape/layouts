const path = require('path')
const fs = require('fs')
const reshape = require('reshape')
const proxyquire = require('proxyquire')
const test = require('ava')
const layouts = require('..')

let mfs = {
  _files: {},
  readFileSync (filePath) {
    return this._files[filePath]
  },
  writeFileSync (filePath, content) {
    const fullPath = path.resolve(filePath)
    this._files[fullPath] = content
  }
}

const extend = proxyquire('../lib/index', { fs: mfs })
const fixtures = path.join(__dirname, 'fixtures')

test.beforeEach(() => { mfs._files = {} })

test('resolves correctly with reshape filename option', (t) => {
  const p = path.join(fixtures, 'basic.html')
  const html = fs.readFileSync(p, 'utf8')
  return reshape({ plugins: layouts(), filename: p })
    .process(html)
    .then((res) => {
      t.truthy(cleanHtml(res.output()) === '<div class="container"><p>hello!</p></div>')
    })
})

test('reports dependencies correctly', (t) => {
  const p = path.join(fixtures, 'basic.html')
  const html = fs.readFileSync(p, 'utf8')

  return reshape({ plugins: layouts(), dependencies: [], filename: p })
    .process(html)
    .then((res) => {
      t.truthy(res.dependencies)
      t.regex(res.dependencies[0].file, /layout\.html/)
      t.regex(res.dependencies[0].parent, /basic\.html/)
      t.truthy(cleanHtml(res.output()) === '<div class="container"><p>hello!</p></div>')
    })
})

test('renders default block content if layout is not extended', (t) => {
  return init('<p><block name="content">content</block></p>')
    .then((html) => t.truthy(html === '<p>content</p>'))
})

test('extends layout', (t) => {
  mfs.writeFileSync('./layout.html', `
    <div class='head'><block name="head">head</block></div>
    <div class='body'><block name="body">body</block></div>
    <sidebar><block name="sidebar"></block></sidebar>
    <div><block name="ad">ad</block></div>
    <footer><block name="footer">footer</block></footer>
  `)

  return init(`
    <extends src="layout.html">
        <block name="ad"></block>
        <block name="head"><title>hello world!</title></block>
        <block name="body">Some body content</block>
    </extends>
  `).then((html) => {
    t.truthy((html) === cleanHtml(`
      <div class="head"><title>hello world!</title></div>
      <div class="body">Some body content</div>
      <sidebar></sidebar>
      <div></div>
      <footer>footer</footer>
    `))
  })
})

test('extends inherited layout', (t) => {
  mfs.writeFileSync('./base.html', `
    <section>
      <div class="head"><block name="head"><title></title></block></div>
      <div class="body"><block name="body"></block></div>
      <footer><block name="footer">footer</block></footer>
    </section>
  `)

  mfs.writeFileSync('./page.html', `
    <extends src="base.html">
      <block name="footer">copyright</block>
      <block name="body">default content</block>
    </extends>
    <!-- page end -->
  `)

  return init(`
      <!-- page start -->
      <extends src="page.html">
          <block name="body">page content</block>
      </extends>
  `).then((html) => {
    t.truthy((html) === cleanHtml(`
      <!-- page start -->
      <section>
        <div class="head"><title></title></div>
        <div class="body">page content</div>
        <footer>copyright</footer>
      </section>
      <!-- page end -->
    `))
  })
})

test('appends and prepend content', (t) => {
  mfs.writeFileSync('./layout.html', `
    <div class="head"><block name="head"><style></style></block></div>
    <div class="body"><block name="body">body</block></div>
    <footer><block name="footer">2015</block></footer>
  `)

  return init(`
    <extends src="layout.html">
      <block name="head" type="prepend"><title>hello!</title></block>
      <block name="body">Some body content</block>
      <block name="footer" type="append">—2016</block>
    </extends>
  `).then((html) => {
    t.truthy((html) === cleanHtml(`
      <div class="head"><title>hello!</title><style></style></div>
      <div class="body">Some body content</div>
      <footer>2015—2016</footer>
    `))
  })
})

test('removes unexpected content from <extends>', (t) => {
  mfs.writeFileSync('./layout.html', '<block name="content"></block>')

  return init(`
    <extends src="layout.html">
      <div>some other content</div>
      <block name="content">hello!</block>
      blah-blah
    </extends>
  `).then((html) => {
    t.truthy(html === cleanHtml('hello!'))
  })
})

test('throws an error if <extends> has no "src"', (t) => {
  return assertError(t,
    init('<extends><block name="content"></block></extends>'),
    /Extends tag has no 'src' attribute/
  )
})

test('throws an error if <block> has no "name"', (t) => {
  mfs.writeFileSync('./test/base.html', 'some content')
  const options = { root: './test' }

  return Promise.all([
    assertError(t,
      init('<extends src="base.html"><block>hello!</block></extends>', options),
      /'block' element is missing a 'name' attribute/
    ),
    assertError(t,
      init('<extends src="base.html"><block class="">hello!</block></extends>', options),
      /'block' element is missing a 'name' attribute/
    )
  ])
})

test('throws an error if <block> is unexpected', (t) => {
  mfs.writeFileSync('./layout.html', '<block name="content"></block>')

  return assertError(t,
    init('<extends src="layout.html"><block name="head"></block></extends>'),
    /Block "head" doesn't exist in the layout template/
  )
})

test('uses the correct source location for layouts and templates', (t) => {
  mfs.writeFileSync('./layout.html', '<p>hi</p><block name="content"></block>')

  const html = '<extends src="layout.html"><block name="content">hello!</block></extends>'

  return reshape({ plugins: [extend(), interceptLocation] })
    .process(html)

  function interceptLocation (tree) {
    t.truthy(tree[0].location.filename.match(/layout\.html/))
    t.truthy(typeof tree[1].location.filename === 'undefined')
    return tree
  }
})

function assertError (t, promise, expectedErrorMessage) {
  return promise
    .catch((error) => error.message)
    .then((errorMessage) => t.truthy(errorMessage.match(expectedErrorMessage)))
}

function init (html, options = {}) {
  return reshape({ plugins: extend(options) })
    .process(html)
    .then((res) => cleanHtml(res.output()))
}

function cleanHtml (html) {
  return html.replace(/>\s+</gm, '><').trim()
}
