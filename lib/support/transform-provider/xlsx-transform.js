const { Duplex, PassThrough } = require('stream')
const ExcelJS = require('exceljs')

/**
 * A transform stream that converts JSON objects to a stream of CSV text.
 */
class XlsxTransform extends Duplex {
  constructor () {
    super({ writableObjectMode: true })
    this._headerWritten = false
    this._pass = new PassThrough()
    this._workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this._pass
    })
    this._worksheet = this._workbook.addWorksheet('Entities')
    this.push = this.push.bind(this)
  }

  end (entity, _, done) {
    return super.end(entity, _, error => {
      if (error) {
        if (done) {
          done(error)
        }
      } else {
        this._worksheet.commit()
        this._workbook.commit().then(done, done)
      }
    })
  }

  _write (entity, _, done) {
    if (Object(entity) === entity && !Array.isArray(entity)) {
      try {
        const header = this._entityToHeader(entity)
        const fields = this._entityToFields(header, entity)
        const headerWritten = this._headerWritten
        this._headerWritten = true
        
        if (headerWritten) {
          this._worksheet.addRow(fields).commit()
        } else {
          this._worksheet.addRow(header).commit()
        }

        done()
      } catch (error) {
        done(error)
      }
    } else {
      done(new Error('XlsxStream can only accept JSON Object values'))
    }
  }

  _read () {
    this._pass.removeAllListeners('data')
    this._pass.on('data', entity => {
      if (!this.push(entity)) {
        this._pass.removeAllListeners('data').pause()
      }
    })
  }

  _entityToHeader (entity) {
    const header = Object.keys(entity)
    if (!header.length) {
      throw new Error('XlsxStream can only accept JSON Object values with properties')
    }
    return header
  }

  _entityToFields (header, entity) {
    return header.map(field => entity[field])
  }
}

exports.XlsxTransform = XlsxTransform
