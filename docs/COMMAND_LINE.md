# Command Line Usage

```
etl                        0.0.1

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


```
