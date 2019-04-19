const fs = require('fs')
const path = require('path')

module.exports = function reshapeLayouts (options = {}) {
  return function layoutsPlugin (tree, ctx) {
    // options cannot be mutated per-compile
    const opts = Object.assign({}, options)

    opts.encoding = opts.encoding || 'utf8'
    if (!opts.root && ctx.filename) {
      opts.root = path.dirname(ctx.filename)
    }
    opts.root = opts.root || './'

    // primary logic
    tree = handleExtendsNodes(tree, opts, ctx)

    // remove block wrapper around contents
    tree = unwrapBlocks(tree)

    return tree
  }
}

function handleExtendsNodes (tree, options, ctx) {
  return tree.reduce((m, node) => {
    // if it's not an "extends" tag, move on
    if (node.name !== 'extends') {
      if (Array.isArray(node.content)) {
        node.content = handleExtendsNodes(node.content, options, ctx)
        m.push(node)
      } else {
        m.push(node)
      }
      return m
    }

    // if the extends tag has no "src", throw an error
    if (!node.attrs || !node.attrs.src) {
      throw new ctx.PluginError({
        message: "Extends tag has no 'src' attribute",
        plugin: 'reshape-extend',
        location: node.location
      })
    }

    // Get the layout file contents and parse it
    const layoutPath = path.resolve(options.root, node.attrs.src[0].content)
    const layoutHtml = fs.readFileSync(layoutPath, options.encoding)
    const parsedLayout = ctx.parser(layoutHtml, { filename: layoutPath })
    const layoutTree = handleExtendsNodes(parsedLayout, options, ctx)

    // add dependency if applicable
    if (ctx.dependencies) {
      ctx.dependencies.push({
        file: layoutPath,
        parent: ctx.filename
      })
    }

    // merge the contents of the current node into the layout
    m = m.concat(mergeExtendsAndLayout(layoutTree, handleExtendsNodes(node.content, options, ctx), ctx))
    return m
  }, [])
}

function mergeExtendsAndLayout (layoutTree, templateTree, ctx) {
  // collect all "block" elements in the layout and template
  const layoutBlockNodes = getBlockNodes(layoutTree, ctx)
  const templateBlockNodes = getBlockNodes(templateTree, ctx)

  for (let layoutBlockName in layoutBlockNodes) {
    // match template block to layout block, if a match exists
    const layoutBlockNode = layoutBlockNodes[layoutBlockName]
    const templateBlockNode = templateBlockNodes[layoutBlockName]
    if (!templateBlockNode) { continue }

    // merge the content of the template block into the layout block
    layoutBlockNode.content = mergeContent(
      templateBlockNode.content,
      layoutBlockNode.content,
      getBlockType(templateBlockNode)
    )

    // remove the template block now that it has been merged
    delete templateBlockNodes[layoutBlockName]
  }

  // if there's a block left over after this, it means it exists in the template
  // but not in the layout template, so we throw an error
  for (let templateBlockName in templateBlockNodes) {
    throw new ctx.PluginError({
      message: `Block "${templateBlockName}" doesn't exist in the layout template`,
      plugin: 'reshape-extend',
      location: templateBlockNodes[templateBlockName].location
    })
  }

  return layoutTree
}

function mergeContent (templateContent = [], layoutContent = [], blockType) {
  switch (blockType) {
    case 'replace':
      layoutContent = templateContent
      break
    case 'prepend':
      layoutContent = templateContent.concat(layoutContent)
      break
    case 'append':
      layoutContent = layoutContent.concat(templateContent)
      break
  }

  return layoutContent
}

function getBlockType (blockNode) {
  // grab the contents of the 'type' attribute
  const blockType = (blockNode.attrs && blockNode.attrs.type)
    ? blockNode.attrs.type[0].content.toLowerCase()
    : ''

  // default block type is 'replace'
  if (['replace', 'prepend', 'append'].indexOf(blockType) === -1) {
    return 'replace'
  }

  return blockType
}

function getBlockNodes (tree = [], ctx) {
  let res = {}
  walk(tree, ctx)
  return res

  function walk (tree, ctx) {
    return tree.map((node) => {
      // recursive walk
      if (node.type === 'tag' && node.content) {
        walk(node.content, ctx)
      }

      // if it's not a block element, move on
      if (node.name !== 'block') return node

      // if the block has no "name" attr, throw an error
      if (!node.attrs || !node.attrs.name) {
        throw new ctx.PluginError({
          message: "'block' element is missing a 'name' attribute",
          plugin: 'reshape-extend',
          location: node.location
        })
      }

      // if it has a name, add it to our result objec
      res[node.attrs.name[0].content] = node
      return node
    }, {})
  }
}

function unwrapBlocks (tree) {
  return tree.reduce((m, node) => {
    if (node.type === 'tag' && node.content) {
      node.content = unwrapBlocks(node.content)
    }
    if (node.name !== 'block') { m.push(node); return m }
    if (node.content) { m = m.concat(node.content) }
    return m
  }, [])
}
