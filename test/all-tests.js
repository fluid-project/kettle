/**
 * Kettle Tests
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

/*global require*/

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../kettle.js"));

fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

kettle.tests.allTests = true;

var testIncludes = [
    // Run all tests included in the list.
    "./SessionTests.js",
    "./ConfigLoaderTests.js",
    "./DataSourceTests.js",
    "./MiddlewareTests.js",
    "./SocketTests.js",
    "./ErrorTests.js"
];
var tests = [];

fluid.each(testIncludes, function (path) {
    tests = tests.concat(fluid.require(path, require));
});

fluid.test.runTests(tests);
