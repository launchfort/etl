const { Transform, Readable, pipeline } = require('stream')
const { pushWithBackpressure } = require('../push-with-backpressure')
const { parseCsv } = require('./parse-csv')

/**
 * Converts a CSV file into a stream of JSON records.
 * 
 * The CSV stream will have its encoding set to "utf-8" when calling this function.
 * 
 * Each JSON record will be keyed with the first CSV record in the file (i.e. the
 * column/field names will be taken from the first line of the file).
 * 
 * The returned Readable stream is readable in object mode, where each record as
 * a JSON object is available on the stream.
 * 
 * @example
 * const r = FS.createReadableStream('data.csv')
 * csvToJsonStream(r).on('data', record => console.log(record))
 * @param {import('stream').Readable} csvStream The CSV string stream to convert into a JSON stream
 * @param {{ columns?: string[] }} [options]
 * @return {import('stream').Readable} The readable stream of JSON records
 */
const csvToJsonStream = (csvStream, { columns = null } = {}) => {
  if (!(csvStream instanceof Readable)) {
    throw new TypeError('CSV stream must be an instance of Readable')
  }

  columns = columns ||
    (
      'ETL_E_COLUMNS' in process.env
        ? process.env.ETL_E_COLUMNS.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean)
        : null
    )

  return pipeline(
    csvStream,
    new CsvRowStream(),
    new JsonStream(columns),
    error => {
      if (error) {
        console.error('CsvExtractor error :: ' + error)
      }
    }
  )
}

// Convert a CSV text stream into a JSON array of strings stream in object mode.
// The CSV headrs are read from the first line in the text stream.
class CsvRowStream extends Transform {
  constructor () {
    super({ readableObjectMode: true })
    this._buffer = ''
    this._columnCount = 0
  }

  _transform (chunk, encoding, done) {
    try {
      this._buffer += chunk
      const { records, lastIndex } = parseCsv(this._buffer, { colCount: this._columnCount })
      if (lastIndex && this._buffer[lastIndex - 1] === '\n') {
        this._buffer = this._buffer.slice(lastIndex)
      }
      if (!this._columnCount) {
        this._columnCount = (records[0] || []).length
      }

      pushWithBackpressure(this, records, done)
    } catch (error) {
      done(error)
    }
  }
}

// Convert a JSON string array object mode stream into a JSON object object mode stream.
// Object field names are read from the first record/entry in the stream.
class JsonStream extends Transform {
  constructor (columns) {
    super({ objectMode: true })
    this._columns = columns ? columns.slice() : columns
  }

  get columns () {
    return this._columns ? this._columns.slice() : null
  }

  set columns (value) {
    if (!Array.isArray(value) || value.some(c => c && typeof c !== 'string')) {
      throw new TypeError('Columns must be an array of non-empty strings')
    }
    this._columns = value.slice()
  }

  _transform (fields, _, done) {
    if (!Array.isArray(fields)) {
      done(null, fields)
    } else if (this._columns && this._columns.length) {
      try {
        if (fields.length !== this._columns.length) {
          throw Object.assign(
            new Error(`Column count mismatch. Expected ${this._columns.length} fields and only got ${fields.length}`),
            { name: 'ColumnMismatchError', fields: fields.slice(), columns: this._columns.slice() }
          )
        }

        const entity = fields.reduce((obj, value, col) => {
          return Object.assign(obj, { [this._columns[col]]: value })
        }, {})
        done(null, entity)
      } catch (error) {
        done(error)
      }
    } else if (!this._columns) {
      try {
        this.columns = fields
        done()
      } catch (error) {
        done(error)
      }
    } else {
      done(null, fields)
    }
  }
}

exports.csvToJsonStream = csvToJsonStream
