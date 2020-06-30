/**
 * Attempts to parse CSV text into an array of CSV records.
 * 
 * Returns a pares result with an array of records in document order. A record is
 * an array of values in document order.
 * 
 * The result also has lastIndex and inComplete, where lastIndex will be 1 passed
 * the last record parsed. If inComplete is true then it means the last record in
 * the text was not completely parsed. These two values are very useful when
 * parsing a stream of text.
 * 
 * @param {string} text The CSV text to parse
 * @param {Object} [options]
 * @param {number} [options.colCount=0] The number of expected columns. If 0 then will use the number of columns in the first record.
 * @param {string} [options.colCount=','] The delimiter
 * @return {{ record: string[][], lastIndex: number, inComplete: boolean }} Parse result
 */
const parseCsv = (text, { colCount = 0, delimiter = ',' } = {}) => {
  if (typeof text !== 'string') {
    throw new TypeError('Text must be a string')
  }
  if (typeof delimiter !== 'string' || delimiter.length !== 1) {
    throw new TypeError('delimiter must be a single character')
  }

  if (!text.length) {
    return { records: [], inComplete: true, lastIndex: 0 }
  }

  let i = 0
  let lastIndex = 0
  let inComplete = false
  let c = text[i]
  let records = []
  let field = ''
  let fields = []

  while (true) {
    c = text[i]

    if (!c) {
      break
    }

    // Skip zero width non breaking spaces
    if (c === '\uFEFF') {
      i += 1
    } else if (!c || (c === '\r' && text[i + 1] === '\n') || c === '\n') {
      if (c === '\r') {
        i += 2
      } else if (c) {
        i += 1
      }

      fields.push(field)

      if (!colCount && records.length) {
        colCount = records[0].length
      }

      if (colCount && fields.length !== colCount) {
        inComplete = true
      }

      if (!inComplete) {
        // Ignore entirely blank records
        if (fields.some(f => f.trim())) {
          records.push(fields)
        }
        lastIndex = i
      }

      fields = []
      field = ''

      if (!c || inComplete) {
        break
      }
    } else if (c === '"') {
      i += 1
      while (true) {
        c = text[i]
        if (!c) {
          field = ''
          inComplete = true
          break
        } else if (c === '"' && text[i + 1] === '"') {
          field += c
          i += 2
        } else if (c === '"') {
          i += 1
          break
        } else {
          field += c
          i += 1
        }
      }
    } else if (c === delimiter) {
      fields.push(field)
      field = ''
      i += 1
    } else {
      field += c
      i += 1
    }
  }

  return { records, inComplete, lastIndex }
}

exports.parseCsv = parseCsv
