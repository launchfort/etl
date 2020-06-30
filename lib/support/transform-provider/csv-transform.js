const { Transform } = require('stream')

/**
 * A transform stream that converts JSON objects to a stream of CSV text.
 */
class CsvTransform extends Transform {
  constructor () {
    super({ writableObjectMode: true, encoding: 'utf8' })
    this._headerWritten = false
  }

  _transform (entity, _, done) {
    try {
      if (Array.isArray(entity)) {
        done(null, this._toLine(entity) + '\r\n')
      } else if (Object(entity) === entity) {
        const header = this._entityToHeader(entity)
        const fields = this._entityToFields(header, entity)
        const headerWritten = this._headerWritten
        this._headerWritten = true
        done(null, [
          headerWritten ? null : this._toLine(header),
          this._toLine(fields)
        ].filter(Boolean).join('\r\n') + '\r\n')
      } else {
        done(new Error('CsvTransform can only accept JSON Object/Array values'))
      }
    } catch (error) {
      done(error)
    }
  }

  _entityToHeader (entity) {
    const header = Object.keys(entity)
    if (!header.length) {
      throw new Error('CsvTransform can only accept JSON Object values with properties')
    }
    return header
  }

  _entityToFields (header, entity) {
    return header.map(field => entity[field])
  }

  _toLine (values) {
    return values
      .map(value => value === null || value === undefined ? '' : value)
      .map(value => value.toString())
      .map(value => {
        if (value.includes('"') || value.includes(',') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      .join(',')
  }
}

exports.CsvTransform = CsvTransform
