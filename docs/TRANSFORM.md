# Transform

Transformers are responsible for transforming JSON object streams to new streams
(i.e. `Transform`).

At the command line you can specify one of the built-in transforms or specify a
custom transform as a path to a Nodejs module (i.e. `./my-module.js`).

## Built-in Transforms

### JSON

```
--transform json ...
```

Transform a JSON object stream into a JSON text stream (i.e. JSON file).

### CSV

```
--transform csv ...
```

Transform a JSON object stream into a CSV text stream (i.e. CSV file).

### XLSX

```
--transform xlsx ...
```

Transform a JSON object stream into an Excel XLSX workbook stream (i.e. XLSX file).

## Custom Transform

```
--transform ./transforms/my-transform.js ...
```

Custom transforms can be specified as a Nodejs module with the following file
extensions: `'', '.js', '.mjs'`.

Tramsform modules must have a default export that is a sync/async factory
function that returns a `stream.Duplex` stream instance.

```js
module.export = function myTransform () {
  return new Transform({
    ...
  })
}
```
