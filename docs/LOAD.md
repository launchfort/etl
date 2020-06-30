# Load

Loaders are responsible for consuming a stream and writing it to another stream
or destination (i.e. stdout, HTTP, etc.).

At the command line you can specify one of the built-in loaders or specify a
custom loader as a path to a Nodejs module (i.e. `./my-module.js`).

## Built-in Loaders

### stdout

```
--load stdout > ...
```

Pipes the stream to `stdout`. Note that before this loader can be used the JSON
object stream must have been transformed into a string or binary stream.

## Custom Loader

```
--load ./loaders/my-loader.js ...
```

Custom loaders can be specified as a Nodejs module with the following file
extensions: `'', '.js', '.mjs'`.

Loader modules must have a default export that is a sync/async factory
function that returns a `stream.Writable` stream instance.

```js
module.export = function myTransform () {
  return new Duplex({
    ...
  })
}
```
