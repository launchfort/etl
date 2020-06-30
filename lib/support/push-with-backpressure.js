const { Duplex } = require('stream')
const Events = require('events')

/**
 * Pushes one or more chunks to a stream stream while handling backpressure.
 * 
 * @example
 * [1, 2, 3, 4, 5, 6, 7, 8, 9 , 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
 * pushWithBackpressure(stream, chunks, () => ...)
 * pushWithBackpressure(stream, ['hi', 'hello'], 'utf8', () => ...)
 * @param {Duplex} stream The Duplex stream the chunks will be pushed to
 * @param {any} chunks The chunk or array of chunks to push to a stream stream
 * @param {string|Function} [encoding] The encoding of each string chunk or callback function
 * @param {Function} [callback] Callback function called after all chunks have been pushed to the stream
 * @retrn {Duplex}
 */
const pushWithBackpressure = (stream, chunks, encoding = null, callback = null) => {
  if (!(stream instanceof Duplex)) {
    throw new TypeError('Argument "stream" must be an instance of Duplex')
  }
  chunks = [].concat(chunks).filter(x => x !== undefined)
  if (typeof encoding === 'function') {
    callback = encoding
    encoding = undefined
  }

  const block = async () => {
    for (const chunk of chunks) {
      if (!stream.push(chunk, ...([encoding].filter(Boolean)))) {
        const pipedStreams = [].concat(
          (stream._readableState || {}).pipes || stream
        ).filter(Boolean)
        await Promise.race(
          pipedStreams.map(s => Events.once(s, 'drain'))
        )
      }
    }
  }

  block().then(callback, callback)
  return stream
}

exports.pushWithBackpressure = pushWithBackpressure
