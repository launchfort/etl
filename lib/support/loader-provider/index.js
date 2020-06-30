const Path = require('path')
const { Writable } = require('stream')

/**
 * @param {string} loaderSource
 * @return {Promise<Writable>}
 */
const LoaderProvider = loaderSource => {
  if (typeof loaderSource !== 'string') {
    throw new TypeError('Argument "loaderSource" must be a string')
  }
  if (!loaderSource.trim()) {
    throw Object.assign(
      new Error('Argument "loaderSource" cannot be blank'),
      { name: 'ArgumentError', argName: 'loaderSource', argValue: loaderSource }
    )
  }

  switch (loaderSource) {
    case 'stdout': return process.stdout.setDefaultEncoding('utf8')
    default:
      switch (Path.extname(loaderSource)) {
        case '':
        case '.js':
        case '.mjs':
          return loadLoaderFromModule(loaderSource)
        default:
          throw Object.assign(
            new Error(`Argument "loaderSource" invalid: ${loaderSource}`),
            { name: 'ArgumentError', argName: 'loaderSource', argValue: loaderSource }
          )
      }
  }
}

const loadLoaderFromModule = async moduleId => {
  let id = moduleId
  if (id.startsWith('.')) {
    id = Path.resolve(id)
  }
  const factory = require(id)
  if (typeof factory !== 'function') {
    throw Object.assign(
      new Error('Loader module must have a default export that is a function'),
      { name: 'InvalidModuleError', moduleId }
    )
  }

  try {
    const writable = await factory()
    if (!(writable instanceof Writable)) {
      throw Object.assign(
        new Error('Loader module factory function must return a Writable stream'),
        { name: 'InvalidLoaderError', moduleId }
      )
    }
    return writable
  } catch (error) {
    if (error.name === 'InvalidLoaderError') {
      throw error
    } else {
      throw Object.assign(
        new Error('Loader error encountered : ' + error),
        { name: 'LoaderError', moduleId, error }
      )
    }
  }
}

exports.LoaderProvider = LoaderProvider
