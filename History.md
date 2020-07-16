# Version History

## 1.13.0 / 2020-07-16

* KETTLE-86: Extended request.events.onSuccess accepting additional arguments allowing custom status codes, and added
  request.outerRequestPromise which accepts a wider framed payload correspondingly.
* KETTLE-84: Extended kettle.test.request.ws to support an onClose event
* Various docs fixes
* General dependency update

## 1.12.0 / 2020-04-10

* KETTLE-82: Fix for client abort causing server exit
* Updates for compatibility with FLUID-6148/FLUID-6145 branches of Infusion - "golden release"
* General dependency update

## 1.11.1 / 2019-05-23

* Reorganisation of request launching logic to permit use under post-FLUID-6148 branches of Infusion
* Significant quantities of JSDocs for core files
* General dependency update

## 1.10.1 / 2019-02-05

* KETTLE-75: Improvements to CLI parsing to allow use of node-directed arguments on electron

## 1.10.0 / 2019-02-04

* KETTLE-73: Improvements to censoring of sensitive values supplied as URL parameters to DataSources
* General dependency updates

## 1.9.0 / 2018-10-17

* KETTLE-73: Allow censoring of sensitive information which may be present in URL of DataSource
* General dependency updates, particularly to recent Infusion with support for `fluid.loggingEvent`

## 1.8.1 / 2018-10-04

* KETTLE-71: Vagrant build courtesy of waharnum
* KETTLE-72: Added form-data to main dependencies rather than dev dependencies
* General dependency updates

## 1.8.0 / 2018-08-16

* KETTLE-66: Multipart form upload middleware based on multer, courtesy of waharnum
* Update to gpii-grunt-lint-all linting rollup resulting in huge changes in formatting
* General dependency updates

## 1.7.1 / 2017-11-17

* FLUID-6225: Update to latest versions of Infusion and node-jqUnit (which have been tested separately)
  to avoid self-deduping race with uncaught exception handler
* KETTLE-65: Update dependencies to latest versions to address security vulnerabilities

## 1.7.0 / 2017-08-31

* GPII-2147: Encode localhost to 127.0.0.1 allowing offline use on Windows
* Updated dependencies to latest versions, with exception of path-to-regexp 2.0.0 which breaks compatibility
  with /* path

## 1.6.4 / 2017-07-24

* GPII-2483: Updated dependencies to allow operation from bare drive letter on Windows

## 1.6.2 / 2017-07-14

* GPII-2483: Corrected bad merge of GPII-2483 branch

## 1.6.1 / 2017-07-13

* GPII-2483: Reverted to Fluid community edition of "resolve" in order to resolve UNC path issues on Windows

## 1.6.0 / 2017-06-16

* KETTLE-59: Implemented "resolvers" to pull environmental values into configs

## 1.5.0 / 2017-05-01

* KETTLE-58: Update to "root-safe" self-deduping Infusion with FLUID-6149
* KETTLE-37: Completed support for JSON5-formatted config files
* Updated all outdated npm dependencies (including to express 4.15.2)

## 1.4.1 / 2017-04-19

* Updated to dev release of Infusion for fix of self-deduping at root - FLUID-6140

## 1.4.0 / 2017-02-18

* KETTLE-57: Fix for failure to properly mark request during action of asynchronous middleware (static serving
  middleware was broken prior to this release)
* Updated to latest dependencies (including ws 2.x)

## 1.3.2 / 2017-01-31

* Updated to quieter version of Infusion and logged created defaults at lower priority

## 1.3.1 / 2017-01-27

* Updated all outdated dependencies (including to an infusion 3.0.0-dev release)

## 1.3.0 / 2017-01-05

* KETTLE-51: Fixed faulty Content-Length header that did not account for length of UTF-8 encoded bytes

## 1.2.2 / 2016-11-23

* Removed unused dependency node-uuid following deprecation warning

## 1.2.1 / 2016-11-14

* GPII-2110: Added JSON5 linting task, moved JS linting to eslint-config-fluid shared rules

## 1.2.0 / 2016-11-03

* GPII-2110: Added support for JSON5 files both in DataSources and configs

## 1.1.1 / 2016-11-01

* KETTLE-48: Updated to latest gpii-express to fix tests under npm 3

## 1.1.0 / 2016-07-15

* KETTLE-45: Fixed implementation of `gradeNames` support for request handlers
* Updated to latest versions of dependencies (ws 1.1.1, express 4.14.0, etc.)

## 1.0.1 / 2016-06-08

* Updated to later versions of Infusion, gpii-express and gpii-pouchdb, moved over to ESLint for linting

## 1.0.0 / 2016-05-26

* First release with reasonable test coverage - consult docs for features
