const { Readable } = require('stream')
const Excel = require('exceljs')

/**
 * Converts a XLSX file into a stream of JSON entities.
 * 
 * The returned Readable stream is readable in object mode, where each entity as
 * a JSON object is available on the stream.
 * 
 * XLSX columns can be inferred by the first non-empty row in the sheet if the
 * columns option is `null` (default). If the columns option is an empty array then the
 * sheet will be read without columns and an entity will be a JSON array of cell
 * values. Otherwise an entity will be a JSON object keyed with column names.
 * 
 * NOTE: There is a known issue with specifying the worksheet name to read. All
 * worksheet names will be "Sheet<id>" where "<id>" is the ordinal number of the
 * sheet in the workbook. This is due to the fact that entire workbook is not
 * read into memory. To help workaround this the "sheetName" option can be a name
 * like "Sheet1" or the ordinal id like "1". If "sheetName" is null then "Sheet1"
 * will be read in (i.e. the first sheet in the workbook).
 * 
 * @example
 * const r = xlsxToJsonStream(FS.createReadStream('my.xlsx'))
 * @param {Readable} xlsxStream The .xslx Readable stream to convert to JSON stream
 * @param {{ sheetName?: string, columns?: string[] }} [options]
 * @return {Readable} The Readable stream of JSON objects
 */
const xlsxToJsonStream = (xlsxStream, { sheetName = null, columns = null } = {}) => {
  const workbookReader = new Excel.stream.xlsx.WorkbookReader(xlsxStream)
  const workSheetNames = (sheetName || process.env.ETL_E_SHEET_NAMES || '').split(/\s*,\s*/)
    .filter(Boolean)
    .map(x => x.trim())
  columns = columns ||
    (
      'ETL_E_COLUMNS' in process.env
        ? process.env.ETL_E_COLUMNS.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean)
        : null
    )
  const matchesWorkSheet = worksheet => {
    // Worksheet names is "*" then we match all sheets
    return (workSheetNames.length === 1 && workSheetNames[0] === '*') ||
    // A direct match for "Sheet1", or "Sheet2", etc.
      workSheetNames.includes(worksheet.name) ||
    // A match for ordinal ID "1", 1, "2", etc.
      workSheetNames.includes(worksheet.id) ||
    // Or the first sheet
      (workSheetNames.length === 0 && worksheet.id === '1')
  }

  async function * streamProvider () {
    let numWorkSheetFound = 0

    for await (const worksheetReader of workbookReader) {
      if (matchesWorkSheet(worksheetReader)) {
        numWorkSheetFound += 1

        for await (const row of worksheetReader) {
          const values = []
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            let value = ''
            switch (cell.type) {
              case Excel.ValueType.Null:
              case Excel.ValueType.Merge:
              case Excel.ValueType.Number:
              case Excel.ValueType.String:
              case Excel.ValueType.Date:
              case Excel.ValueType.Boolean:
                value = cell.value
                break
              case Excel.ValueType.Hyperlink:
                value = cell.hyperlink
                break
              case Excel.ValueType.Formula:
                value = cell.result
                break
              case Excel.ValueType.RichText:
                value = cell.html
                break
              default:
                value = cell.text
            }
            values.push(value)
          })

          if (!values.every(x => !x)) {
            if (columns && columns.length) {
              yield columns.reduce((json, col, index) => {
                return Object.assign(json, { [col]: values[index] || '' })
              }, {})
            } else if (!columns && values.length) {
              columns = values
            } else if (values.length) {
              yield values
            }
          }
        }

        if (numWorkSheetFound == workSheetNames.length ||
            (!workSheetNames.length && numWorkSheetFound === 1)) {
          break
        }
      }
    }

    if (!numWorkSheetFound) {
      throw Object.assign(
        new Error(`Argument "sheetName" not found in workbook: ${sheetName || '(Workbook has no sheets)'}`),
        { name: 'ArgumentError', argName: 'sheetName', argValue: sheetName }
      )
    }
  }

  return Readable.from(streamProvider())
}

exports.xlsxToJsonStream = xlsxToJsonStream
