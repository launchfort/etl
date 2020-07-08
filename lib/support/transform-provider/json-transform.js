const OS = require('os')
const { Transform } = require('stream')

const EOL = process.env.ETL_T_EOL || OS.EOL

class JsonTransform extends Transform {
  constructor ({ pretty = null } = {}) {
    super({ writableObjectMode: true, encoding: 'utf8' })
    this._firstWrite = true
    this._pretty = typeof pretty === 'boolean'
      ? pretty
      : !!process.env.ETL_T_PRETTY
  }

  _transform (obj, _, done) {
    try {
      let lead = ''
      let str = ''
      if (this._pretty) {
        lead = this._firstWrite ? `[${EOL}  ` : `,${EOL}  `
        str = JSON.stringify(obj, null, 2).replace(/\n/gu, '\n  ')
      } else {
        lead = this._firstWrite ? '[' : ','
        str = JSON.stringify(obj)
      }
      this._firstWrite = false
      done(null, lead + str)
    } catch (error) {
      done(error)
    }
  }

  _flush (done) {
    this.push(this._pretty ? `${EOL}]` : ']')
    done()
  }
}

exports.JsonTransform = JsonTransform
