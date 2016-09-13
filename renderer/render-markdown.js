const marked = require('marked')
const highlightjs = require('highlight.js')

const emojiRegex = /:([A-Za-z0-9_\-\+\xff]+?):/g
const listItemRegex = /^\[(x|\s)\]\s*(.+)$/
const doneItemRegex = /\*(.*?)\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]/g
const doneLabelRegex = /^Done$/

// Replace single list space newlines with 2 newlines, so that markdown correctly renders it
const singleListSpaceRegex = /(\*.*)\n{2}(\*)/gm

// Match any headers (that aren't dates) that don't have anything until the next header.
// Tomorrow is special, because it is specified as a header with ------ underneath.
const emptyHeaderRegex = /(#+\s*[^/\n]*\s+)(#+|Tomorrow)/gm

function escapeUnderscore (str) {
  return str.replace(/[_]/g, '\xff')
}

function unescapeUnderscore (str) {
  return str.replace(/[\xff]/g, '_')
}

function escapeEmoji (str) {
  return str.replace(emojiRegex, function (match, emojiname) {
    return ':' + escapeUnderscore(emojiname) + ':'
  })
}

function unescapeEmoji (str) {
  return str.replace(emojiRegex, function (match, emojiname) {
    return ':' + unescapeUnderscore(emojiname) + ':'
  })
}

// Preprocess text before going into marked
function preprocess (src) {
  // Remove headers with no bodies
  let newSrc = src.replace(emptyHeaderRegex, function (match, header, rest) {
    return rest
  })

  // Replace single spaces in lists
  newSrc = newSrc.replace(singleListSpaceRegex, function (match, before, after) {
    return before + '\n\n\n' + after
  })

  // Add style to timestamps and checkboxes
  newSrc = newSrc.replace(doneItemRegex, function (match, item, timestamp) {
    return '* [x] ' + item + '<span class="timestamp">' + timestamp + '<span/>'
  })

  return newSrc
}

var renderer = new marked.Renderer()

renderer.text = function (text) {
  let newText = text.replace(emojiRegex, function (match, emojiname) {
    emojiname = unescapeUnderscore(emojiname)
    return '<img alt=":' + emojiname + ':" src="emoji://' + emojiname + '" />'
  })

  // Mark done headers so that we can style their lists
  newText = newText.replace(doneLabelRegex, function (match) {
    return '<h4 class="done-list">Done</h4>'
  })

  return newText
}

var originalListItemRenderer = marked.Renderer.prototype.listitem

renderer.listitem = function (text) {
  var match = listItemRegex.exec(text)
  if (match) {
    var label = match[2]
    var checked = match[1] === 'x' ? 'checked' : ''

    text = '<label><input type="checkbox" class="task-list-item-checkbox" disabled ' + checked + ' /> ' + label + '</label>'

    return '<li class="task-list-item">' + text + '</li>'
  }

  return originalListItemRenderer(text)
}

var originalInlineOutput = marked.InlineLexer.prototype.output

marked.InlineLexer.prototype.output = function (src) {
  return unescapeEmoji(originalInlineOutput.call(this, escapeEmoji(src)))
}

var originalCodeRenderer = marked.Renderer.prototype.code

renderer.code = function (code, language) {
  var html = originalCodeRenderer.call(this, code, language)
  return html.replace(/<pre>/, '<pre class="hljs">')
}

marked.setOptions({
  renderer: renderer,
  smartLists: true,
  highlight: function (code, lang) {
    return highlightjs.highlightAuto(code, [lang]).value
  }
})

module.exports = function (src) {
  preprocessedSrc = preprocess(src)

  return marked(preprocessedSrc)
}
