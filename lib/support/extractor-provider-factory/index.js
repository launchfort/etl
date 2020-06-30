const FS = require('fs')
const Path = require('path')
const Https = require('https')
const { Readable } = require('stream')
const StreamJoin = require('stream-join')
const { csvToJsonStream } = require('./csv-to-json-stream')
const { xlsxToJsonStream } = require('./xlsx-to-json-stream')
const pkg = require('../../../package.json')

/**
 * @param {string} fileName
 * @return {() => Readable}
 */
const FileStreamProviderFactory = fileName => {
  switch (Path.extname(fileName)) {
    case '.csv': return () => {
      return csvToJsonStream(
        FS.createReadStream(fileName, { encoding: 'utf8' })
      )
    }
    case '.xlsx': return () => {
      return xlsxToJsonStream(
        FS.createReadStream(fileName)
      )
    }
    // case '.json': TODO
    // case '.xml': TODO
    default:
      throw Object.assign(
        new Error(`Argument "fileName" invalid: ${value}. Expected .csv, .xlsx, .json or .xml file extension.`),
        { name: 'ArgumentError', argName: 'fileName', argValue: fileName }
      )
  }
}

/**
 * @param {string|URL} uri
 * @return {() => Promise<Readable>}
 */
const UrlStreamProviderFactory = uri => () => {
  const url = new URL(uri)
  const headers = Object.keys(process.env)
    .filter(key => key.startsWith('ETL_E_HEADER_') && key.length > 13)
    .reduce((headers, key) => {
      return Object.assign(headers, {
        [key.split('ETL_E_HEADER_')[1]]: process.env[key].trim()
      })
    }, {})

  const urlToStream = (url, { maxRedirects = 2, redirectCount = 0 } = {}) => {
    return new Promise((resolve, reject) => {
      Https.get(url.toString(), {
        headers: {
          ...headers,
          'user-agent': `etl/${pkg.version} (nodejs)`,
          'accept': [
            'text/csv;0.9',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;0.8'
            // 'application/json;0.7',
            // 'application/xml;0.6',
            // 'text/xml;0.5'
          ].join(', ')
        }
      }, res => {
        const contentType = res.headers['content-type']
        const statusCode = res.statusCode
        const redirectUrl = res.headers['location'] || ''
        
        switch (statusCode) {
          case 200:
            if (/^text\/csv/.test(contentType)) {
              resolve(csvToJsonStream(res))
            // } else if (/^(text|application)\/xml/.test(contentType)) {
            //   TODO
            // } else if (/^application\/json/.test(contentType)) {
            //   TODO
            // }
            } else if (/^application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/.test(contentType)) {
              resolve(xlsxToJsonStream(res))
            } else {
              reject(Object.assign(
                new Error(`Invalid content type "${res.headers['content-type']}"`),
                { name: 'HTTPRequestError', respnose: res }
              ))
            }
            break
          case 302:
          case 307:
            if (redirectCount < maxRedirects) {
              resolve(urlToStream(redirectUrl, { redirectCount: redirectCount + 1 }))
            } else {
              reject(
                Object.assign(
                  new Error('Too many redirects encountered'),
                  { name: 'TooManyRedirectsError', url: url.toString() }
                )
              )
            }
            break
          default:
            reject(Object.assign(
              new Error(`HTTP request error with status code ${res.statusCode}`),
              { name: 'HTTPRequestError', response: res, url: url.toString() }
            ))
        }
      }).once('error', reject)
    })
  }

  return urlToStream(url)
}

const loadExtractorFromModule = moduleId => {
  let id = moduleId
  if (id.startsWith('.')) {
    id = Path.resolve(id)
  }
  const factory = require(id)
  if (typeof factory !== 'function') {
    throw Object.assign(
      new Error('Extractor module must have a default export that is a function'),
      { name: 'InvalidModuleError', moduleId }
    )
  }

  return async () => {
    try {
      const readable = await factory()
      if (!(readable instanceof Readable)) {
        throw Object.assign(
          new Error('Extractor module factory function must return a Readable stream'),
          { name: 'InvalidExtractorError', moduleId }
        )
      }
      // NOTE (dschnare): This property only exists since Node v12.3.0
    // For older versions of node we can't check this property.
    if (typeof readable.readableObjectMode === 'boolean' && !readable.readableObjectMode) {
      throw Object.assign(
        new Error(`Extractor module(${moduleId}) factory function must return a Readable with readableObjectMode true`),
        { name: 'InvalidExtractorError', moduleId }
      )
    }
      return readable
    } catch (error) {
      if (error.name === 'InvalidExtractorError') {
        throw error
      } else {
        throw Object.assign(
          new Error('Extractor error encountered : ' + error),
          { name: 'ExtractorError', moduleId, error }
        )
      }
    }
  }
}

/**
 * 
 * @param {string} extractorSource
 * @return {() => Promise<Readable>|Readable}
 */
const ExtractorProviderFactory = extractorSource => {
  if (typeof extractorSource !== 'string') {
    throw new TypeError('Argument "extractorSource" must be a string')
  }
  if (!extractorSource.trim()) {
    throw Object.assign(
      new Error('Argument "extractorSource" cannot be blank'),
      { name: 'ArgumentError', argName: 'extractorSource', argValue: extractorSource }
    )
  }

  if (FS.existsSync(extractorSource)) {
    return FileStreamProviderFactory(extractorSource)
  } else if (/^https:\/\/.+/.test(extractorSource)) {
    return UrlStreamProviderFactory(extractorSource)
  } else if (['', '.js', '.mjs'].includes(Path.extname(extractorSource))) {
    return loadExtractorFromModule(extractorSource)
  } else {
    throw Object.assign(
      new Error(`Argument "extractorSource" invalid: ${extractorSource}`),
      { name: 'ArgumentError', argName: 'extractorSource', argValue: extractorSource }
    )
  }
}
/**
 * @param {Array<() => Promise<Readable>|Readable>} extractorProviders
 * @return {Promise<Readable>}
 */
ExtractorProviderFactory.concat = async extractorProviders => {
  if (!Array.isArray(extractorProviders)) {
    throw new TypeError('Argument "extractorProviders" must be an array')
  }

  if (extractorProviders.length === 1) {
    return await extractorProviders[0]()
  }

  return concatReadableStreams(
    await Promise.all(
      extractorProviders.map(extractorProvider => extractorProvider())
    )
  )
}
/**
 * @param {Array<() => Promise<Readable>|Readable>} extractorProviders
 * @return {Promise<Readable>}
 */
ExtractorProviderFactory.join = async extractorProviders => {
  if (!Array.isArray(extractorProviders)) {
    throw new TypeError('Argument "extractorProviders" must be an array')
  }

  return StreamJoin(
    await Promise.all(
      extractorProviders.map(extractorProvider => extractorProvider())
    )
  )
}

/**
 * @param {Readable[]} streams
 * @return {Readable}
 */
function concatReadableStreams (streams) {
  async function * block () {
    for (const stream of streams) {
      for await (const json of stream) {
        yield json
      }
    }
  }

  return Readable.from(block())
}

exports.ExtractorProviderFactory = ExtractorProviderFactory
