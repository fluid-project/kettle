1.3.0 / 2017-01-05
==================

* KETTLE-51: Fixed faulty Content-Length header that did not account for length of UTF-8 encoded bytes

1.2.2 / 2016-11-23
==================

* Removed unused dependency node-uuid following deprecation warning

1.2.1 / 2016-11-14
==================

* GPII-2110: Added JSON5 linting task, moved JS linting to eslint-config-fluid shared rules

1.2.0 / 2016-11-03
==================

* GPII-2110: Added support for JSON5 files both in DataSources and configs 

1.1.1 / 2016-11-01
==================

* KETTLE-48: Updated to latest gpii-express to fix tests under npm 3

1.1.0 / 2016-07-15
==================

* KETTLE-45: Fixed implementation of `gradeNames` support for request handlers
* Updated to latest versions of dependencies (ws 1.1.1, express 4.14.0, etc.)

1.0.1 / 2016-06-08
==================

* Updated to later versions of Infusion, gpii-express and gpii-pouchdb, moved over to ESLint for linting

1.0.0 / 2016-05-26
==================

* First release with reasonable test coverage - consult docs for features
