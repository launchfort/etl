const Path = require('path')
const { Duplex } = require('stream')
const { CsvTransform } = require('./csv-transform')
const { JsonTransform } = require('./json-transform')
const { XlsxTransform } = require('./xlsx-transform')

/**
 * @param {string} transformSource
 * @return {Promise<Duplex> | Duplex}
 */
const TransformProvider = transformSource => {
  if (typeof transformSource !== 'string') {
    throw new TypeError('Argument "transformSource" must be a string')
  }
  if (!transformSource.trim()) {
    throw Object.assign(
      new Error('Argument "transformSource" cannot be blank'),
      { name: 'ArgumentError', argName: 'transformSource', argValue: transformSource }
    )
  }

  switch (transformSource) {
    case 'json': return new JsonTransform()
    case 'csv': return new CsvTransform()
    case 'xlsx': return new XlsxTransform()
    // case 'xml':
    default:
      switch (Path.extname(transformSource)) {
        case '':
        case '.js':
        case '.mjs':
          return loadTransformFromModule(transformSource)
        default:
          throw Object.assign(
            new Error(`Argument "transformSource" invalid: ${transformSource}`),
            { name: 'ArgumentError', argName: 'transformSource', argValue: transformSource }
          )
      }
  }
}

const loadTransformFromModule = async moduleId => {
  let id = moduleId
  if (id.startsWith('.')) {
    id = Path.resolve(id)
  }
  const factory = require(id)
  if (typeof factory !== 'function') {
    throw Object.assign(
      new Error('Transform module must have a default export that is a function'),
      { name: 'InvalidModuleError', moduleId }
    )
  }

  try {
    const transform = await factory()
    if (!(transform instanceof Duplex)) {
      throw Object.assign(
        new Error('Transform module factory function must return a Duplex stream'),
        { name: 'InvalidTransformError' }
      )
    }
    return transform
  } catch (error) {
    if (error.name === 'InvalidTransformError') {
      throw error
    } else {
      throw Object.assign(
        new Error('Transform error encountered : ' + error),
        { name: 'TransformError', moduleId, error }
      )
    }
  }
}

exports.TransformProvider = TransformProvider
