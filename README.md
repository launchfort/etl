# ETL

Extract, transform and load CLI tool.

## Install

```
npm install -g launchfort/etl#v0.0.1
```

## Quick Start

Extract records from an Excel workbook, and save to the filesystem as a CSV:

```
etl --extract ./my-workbook.xlsx --transform csv --load stdout > my-data.csv
```

This quickstart example demonstrates the core concepts: extract, transform, and
load. Extract is responsible for consuming data from a source and making it
available as a stream of JSON objects. Transform is responsible for transforming
JSON object streams. Load is responsible for writing JSON object streams to a
destination.

## Guides and Documentation

- [Command Line Usage](./docs/COMMAND_LINE.md)
- [Extract](./docs/EXTRACT.md)
- [Transform](./docs/TRANSFORM.md)
- [Load](./docs/LOAD.md)
