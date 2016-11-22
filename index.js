'use strict'
var pull = require('pull-stream')
var query = require('./query')
var select = require('./select')
var mfr = require('map-filter-reduce')
var keys = require('map-filter-reduce/keys')
var explain = require('explain-error')
var u = require('./util')

var FlumeViewLevel = require('flumeview-level')

var isArray = Array.isArray

//sorted index.

//split this into TWO modules. flumeview-links and flumeview-query
module.exports = function (indexes, version) {

  var create = FlumeViewLevel(version || 1, function (data, seq) {
    var A = []
    indexes.forEach(function (index) {
      var a = [index.key]
      for(var i = 0; i < index.value.length; i++) {
        var key = index.value[i]
        if(!u.has(key, data)) return []
        a.push(u.get(key, data))
      }
      a.push(seq); A.push(a)
    })
    return A
  })

  return function (log, name) {

    var index = create(log, name)
    var read = index.read

    index.read = function (opts) {

      opts = opts || {}
      var _opts = {}
      var q, k

      if(isArray(opts.query)) {
        q = opts.query[0].$filter || {}
      }
      else if(opts.query) {
        q = opts.query
      }
      else
        q = {}

      var index = select(indexes, q)

      if(!index)
        return log.stream({
          values: true, seqs: false, live: opts.live, limit: opts.limit, reverse: opts.reverse
        })

      var _opts = query(index, q)

      _opts.values = false
      _opts.keys = true

      _opts.reverse = !!opts.reverse
      _opts.live = opts.live
      _opts.old = opts.old
      _opts.sync = opts.sync

      return pull(
        read(_opts), pull.map('value'),
        isArray(opts.query) ? mfr(opts.query) : pull.through()
      )

    }

    return index
  }
}

