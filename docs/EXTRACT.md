# Extract

Extractors are responsible for consuming data from a data source and providing
that data as a JSON object stream.

At the command line you can specify one of the built-in extractors or specify a
custom extractor as a path to a Nodejs module (i.e. `./my-module.js`).

## Built-in Extractors

### CSV

```
--extract ./my-data.csv ...
```

Any CSV file following [RFC4180](https://tools.ietf.org/html/rfc4180) will be
read and converted to a JSON stream.

Column names will be read from the first line of the file or from the comma
separated value as provided by the environment variable `ETL_E_COLUMNS`.

If `ETL_E_COLUMNS` is blank, then the CSV file will be processed as a stream of
JSON arrays of field values. If the number of column names do not match the
number of columns in the file, then an error is raised.

Otherwise the CSV file will be processed as a stream of JSON objects, where each
property in the JSON object is a column name.

### XLSX

```
--extract ./my-workbook.xlsx ...
```

Any valid XLSX Excel workbook will one or more sheets read and converted to a
JSON stream.

By default will read the first sheet in the workbook. The sheet names to read
can be specified with the environment variable `ETL_E_SHEET_NAMES` as a comma
separated value.

Due to a side affect of streaming the Excel worksheet rather than reading the
entire file into memore, sheet names must follow these guidelines:

1) `SheetN` where `N` is the ordinal number of the sheet
2) `N` where `N` is the ordinal number of the sheet

Column names will be read from the first row from a sheet or from the comma
separated value as provided by the environment variable `ETL_E_COLUMNS`. If the
number of column names do not match the numer of columns in the sheet, then an
error is raised.

If `ETL_E_COLUMNS` is blank the sheet will be processed as a stream of JSON
arrays of field values.

### URL

```
--extract https://example.com/data/dump ...
```

Any HTTPS endpoint can be requested via GET request and the response converted
to a JSON stream.

The following Content-Type values are supported:

- CSV: text/csv
- XLSX: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

*NOTE: At this time any Content-Disposition header value is ignored.

The following headers are sent with the GET request:

- `User-Agent: etc/0.0.1 (nodejs)`
- `Accept: text/csv;0.9, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;0.8`

Custom headers can be sent by specifying environment variables with the prefix
`ETL_E_HEADER_`.

For example: `ETL_E_HEADER_AUTHORIZATION=<token>`

In addition, when the response is a CSV or XLSX stream, the environment variables
as described above can be specified to control processing.

## Custom Extractors

```
--extract ./extractors/my-extractor.js ...
```

Custom extractors can specified as a Nodejs module with the following file
extensions: `'', '.js', '.mjs'`.

Extractor modules must have a default export that is a sync/async factory
function that returns a JSON stream as a `stream.Readable` instance.

```js
module.export = function myExtractorFactory () {
  return Readable.from(...)
}
```
