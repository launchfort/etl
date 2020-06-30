/*
 * TODO: Describe what this script does and why/how to use it.

 etl \
  --input=file.[xml|json|xlsx|csv] \
  --input=file.[xml|json|xlsx|csv] \
  --generator=./module \
  --generator=./module \
  --transform=./module \
  --transform=./module \
  --transform=./module \
  --transform=./module \
  --validate=schema.json \
  --validate=./module \
  --export=[json|csv]

 */
const { promisify } = require('util')
const { pipeline, Readable, Duplex, Writable, Stream } = require('stream')
const { ExtractorProviderFactory } = require('./support/extractor-provider-factory')
const { LoaderProvider } = require('./support/loader-provider')
const { TransformProvider } = require('./support/transform-provider')
const { pushWithBackpressure } = require('./support/push-with-backpressure')


/**
 * Writes the standard help message to stdout and exits the process.
 */
const help = (exitCode = 0) => {
  const pkg = require('../package.json')
  console.log(
`etl                        ${pkg.version}

Import, transform and export data records.

Usage:

  node etl [options]

--help                      Show this help dialog.

--extract-concat            When specifiying multiple extractor sources, instead
                            of joining the sources, concatenate the sources into
                            a single series of entities. All transforms will be
                            passed a single entity instead of an array of
                            entities.

--extract, -e <source>      An entity extractor source as either a file name,
                            HTTPS URL, or Nodejs module. Specifying multiple
                            extractors will by default join the entities one at
                            at time from each extractor into an entity set. At
                            least one extractor is required.

                            File names must have one of these extensions:

                            - '*.csv'
                            - '*.xlsx'.

                            URLS must use the https:// protocol and the only
                            HTTP status 200 and the following content types are
                            supported:

                            - text/csv (CSV)
                            - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)

                            Nodejs modules must have a default export that is a
                            sync/async factory function that returns a Readable
                            stream object. Relative module IDs are relative to
                            the current working directory.

--transform, -t <source>    A entity transform source as either a built-in
                            transform type or a module ID. Can occur multiple
                            times to apply multiple transforms in the order
                            specified.

                            Built-in transform types supported:

                            - "csv"  Converts the stream of entities to CSV text
                            - "json" Converts the stream of entites to JSON text
                            - "xlsx" Converts the stream of entites to XLSX text

                            Nodejs modules must have a default export that is a
                            sync/async factory function that returns a Duplex
                            stream object. Relative module IDs are relative to
                            the current working directory.

--load, -l <source>         An entity loader source as either a built-in
                            loader type or a module ID. Defaults to "stdout" if
                            not specified at the command line.

                            Built-in loader types supported:

                            - "stdout"  Pipe the stream to stdout. Note that
                                        there must be a transform used that
                                        transforms the entity stream into a
                                        stream of text.

                            Nodejs modules must have a default export that is a
                            sync/async factory function that returns a Writable
                            stream object. Relative module IDs are relative to
                            the current working directory.
`
  )
  process.exit(exitCode)
}

/**
 * Main entry point of the script.
 * 
 * @param {{ input: Readable, transforms: Array<Duplex>, loader: Writable }} config
 * @return {Promise<Stream>}
 */
const main = ({ input, transforms, loader }) => {
  if (!(input instanceof Readable)) {
    throw new TypeError('Argument "input" must be an instance of Readable')
  }
  if (!Array.isArray(transforms)) {
    throw new TypeError('Argument "transforms" must be an array')
  }
  if (transforms.some(t => !(t instanceof Duplex))) {
    throw new TypeError('Argument "transforms" must be an array of Duplex streams')
  }
  if (!(loader instanceof Writable)) {
    throw new TypeError('Argument "loader" must be an instance of Writable')
  }

  const p = promisify(pipeline)
  return p(input, ...transforms, loader)
}


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Attempts to read a command line option from the arguments list.
 * 
 * If you specifify a type it will be used as a converer.
 * Supported types:
 * 
 * - String
 * - Number
 * - Boolean
 * - URL
 * - Date
 * - array of string - Represents an enumeration of accepted values
 * - <custom> - Any function that takes a string and returns a value
 * 
 * @example
 * readOption(['--opt=value', '--opt', 'value'], ['opt', 'o'], { multiple: true })
 * @param {string[]} args The command line arguments
 * @param {string[]} names Ordered list of option names
 * @param {{ multiple?: boolean, required?: boolean, type?: (x:string)=>any|string[] }} [options]
 */
const readOption = (args, names, { multiple = false, required = false, type = String } = {}) => {
  if (typeof type !== 'function' && !Array.isArray(type)) {
    throw new TypeError('Argument "type" must be a function or an enum array')
  }

  const values = []
  for (let a = 0; a < args.length; a += 1) {
    const arg = args[a]
    if (arg.startsWith('-')) {
      const optionName = arg.replace(/^-+/gu, '').split('=')[0]

      if (!names.includes(optionName)) {
        continue
      }

      let optionValue = ''
      if (arg.includes('=')) {
        optionValue = arg.split('=').slice(1).join('=').replace(/^["']|["']$/gu, '')
      } else if (!(args[a + 1] || '').includes('=')) {
        a += 1
        optionValue = (args[a] || '').replace(/^["']|["']$/gu, '')
      }

      switch (type) {
        case String:
          if (!optionValue) {
            throw Object.assign(
              new Error(`Command option "${optionName}" must be a non-empty string`),
              { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue }
            )
          }
          break
        case Number:
          optionValue = parseFloat(optionValue)
          if (!Number.isFinite(optionValue)) {
            throw Object.assign(
              new Error(`Command option "${optionName}" must be a number`),
              { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue }
            )
          }
          break
        case Boolean:
          switch (optionValue) {
            case '':
            case 'true':
            case 'yes':
            case '1':
              optionValue = true
              break
            case 'false':
            case 'no':
            case '0':
              optionValue = false
              break
            default:
              throw Object.assign(
                new Error(`Command option "${optionName}" is a flag with an invalid value`),
                { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue }
              )
          }
          break
        case URL:
          optionValue = new URL(optionValue)
          break
        case Date:
          const d = Date.parse(optionValue)
          if (isNaN(d)) {
            throw Object.assign(
              new Error(`Command option "${optionName}" must be a date pasrsable by Date.parse`),
              { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue }
            )
          }
          optionValue = new Date(d)
          break
        default:
          if (typeof type === 'function') {
            try {
              optionValue = type(optionValue)
            } catch (error) {
              throw Object.assign(
                new Error(`Command option "${optionName}" is invalid : ${error.message}`),
                { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue, error }
              )
            }
          } else {
            if (!type.includes(optionValue)) {
              throw Object.assign(
                new Error(`Command option "${optionName}" is invalid`),
                { name: 'InvalidCommandOptionError', optionName, optionValue: optionValue }
              )
            }
          }
      }
      values.push(optionValue)
    }
  }

  if (required && !values.length) {
    throw Object.assign(
      new Error(`Option "${names[0]}" is required`),
      { name: 'MissingCommandOptionError', optionName: names[0] }
    )
  }

  if (multiple) {
    return values
  } else if (values.length > 1) {
    throw Object.assign(
      new Error(`Option "${names[0]}" can only be specified once`),
      { name: 'InvalidCommandOptionError', optionName: names[0], optionValue: values }
    )
  } else {
    return values[0] || ''
  }
}


// -----------------------------------------------------------------------------
// Script Entry Point
// -----------------------------------------------------------------------------


const entry = async () => {
  const args = process.argv.slice(2)
  /** @type {boolean} */
  const showHelp = readOption(args, ['help'], { type: Boolean }) || false

  if (showHelp) {
    help()
  }

  /** @type {boolean} */
  const concatExtractors = readOption(args, ['extract-concat'], { type: Boolean }) || false
  /** @type {() => Promise<Readable>|Readable} */
  const extractorProviders = readOption(args, ['extract', 'e'], { multiple: true, type: ExtractorProviderFactory, required: true })
  /** @type {Array<Promise<Duplex>|Duplex>} */
  let transforms = readOption(args, ['transform', 't'], { multiple: true, type: TransformProvider })
  // /** @type {Promise<Writable>|Writable} */
  let loader = readOption(args, ['load', 'l'], { type: LoaderProvider, required: true })

  transforms = await Promise.all(transforms)
  loader = await loader

  /** @type {Promise<Readable>} */
  let input = null
  if (concatExtractors || extractorProviders.length === 1) {
    input = await ExtractorProviderFactory.concat(extractorProviders)
  } else {
    input = await ExtractorProviderFactory.join(extractorProviders)
  }

  try {
    main({ input, transforms, loader }).catch(error => {
      console.error(error)
      process.exit(30)
    })
  } catch (error) {
    console.error(error)
    process.exit(20)
  }
}

exports.ExtractorProviderFactory = ExtractorProviderFactory
exports.TransformProvider = TransformProvider
exports.LoaderProvider = LoaderProvider
exports.pushWithBackpressure = pushWithBackpressure
exports.etl = main

if (require.main === module) {
  entry().catch(error => {
    console.error(error)
    process.exit(10)
  })
}
